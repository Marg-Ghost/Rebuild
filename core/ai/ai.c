// ai.c
// Wird per subprocess von Python aus gestartet:  ./ai <input_shm_name> <output_shm_name>
// Liest ein FESTES Speicherlayout aus dem Input-Shared-Memory 
// bei 0 modi _ nur forward
//bei 1 modi _ backpropagation

//   gcc -O2 -o core/ai/ai ai.c -lrt -lm

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#include <errno.h>

// const
#define INPUT_NEURONEN   8
#define HIDDEN_NEURONEN  8
#define OUTPUT_NEURONEN  1

#define W1_SIZE (HIDDEN_NEURONEN * INPUT_NEURONEN)   // 64 == 8x8 M.
#define B1_SIZE HIDDEN_NEURONEN                       // 8
#define W2_SIZE (HIDDEN_NEURONEN * HIDDEN_NEURONEN)   // 64 == 8x8 M.
#define B2_SIZE HIDDEN_NEURONEN                       // 8
#define W3_SIZE (OUTPUT_NEURONEN * HIDDEN_NEURONEN)   // 8
#define B3_SIZE OUTPUT_NEURONEN                        // 1
#define INPUT_SIZE INPUT_NEURONEN                      // 8

// Prototypen
float* shm_oeffnen(const char* name, size_t anzahl_floats);
void forward_step(float* W1, float* b1, float* W2, float* b2, float* W3, float* b3, float* input, float* h1, float* h2, float* output);
void backprop_step(float* W1, float* b1, float* W2, float* b2, float* W3, float* b3, float* input, float* h1, float* h2, float* output, float* erwartet, float lernrate);
float sigmurid(float x);
float sigmurid_ableitung(float aktiviert);
void print_array(const char* name, float* arr, size_t size);


int main(int argc, char* argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Nutzung: %s <input_shm_name> <output_shm_name>\n", argv[0]);
        return 1;
    }

    float* in_buf = shm_oeffnen(argv[1], IN_BUF_FLOATS);
    float* out_buf = shm_oeffnen(argv[2], OUT_BUF_FLOATS);

    int pos = 0;
    float modus = in_buf[pos]; pos += 1;

    float* W1 = &in_buf[pos]; pos += W1_SIZE;
    float* b1 = &in_buf[pos]; pos += B1_SIZE;
    float* W2 = &in_buf[pos]; pos += W2_SIZE;
    float* b2 = &in_buf[pos]; pos += B2_SIZE;
    float* W3 = &in_buf[pos]; pos += W3_SIZE;
    float* b3 = &in_buf[pos]; pos += B3_SIZE;
    float* input_vector = &in_buf[pos]; pos += INPUT_SIZE;
    float* expected = &in_buf[pos]; pos += OUTPUT_NEURONEN;
    float lernrate = in_buf[pos]; pos += 1;

    float h1[HIDDEN_NEURONEN], h2[HIDDEN_NEURONEN], output[OUTPUT_NEURONEN];

    forward_step(W1, b1, W2, b2, W3, b3, input_vector, h1, h2, output);

    if (modus > 0.5f) {
        // backprop_step aendert W1/b1/W2/b2/W3/b3 DIREKT im Speicher
        // (sie sind ja Pointer in den mmap'ten Bereich hinein) - danach
        // nochmal forward, damit "output" die Vorhersage NACH dem
        // Trainingsschritt zeigt.
        backprop_step(W1, b1, W2, b2, W3, b3, input_vector, h1, h2, output, expected, lernrate);
        forward_step(W1, b1, W2, b2, W3, b3, input_vector, h1, h2, output);
    }

    int out_pos = 0;
    memcpy(&out_buf[out_pos], W1, W1_SIZE * sizeof(float)); out_pos += W1_SIZE;
    memcpy(&out_buf[out_pos], b1, B1_SIZE * sizeof(float)); out_pos += B1_SIZE;
    memcpy(&out_buf[out_pos], W2, W2_SIZE * sizeof(float)); out_pos += W2_SIZE;
    memcpy(&out_buf[out_pos], b2, B2_SIZE * sizeof(float)); out_pos += B2_SIZE;
    memcpy(&out_buf[out_pos], W3, W3_SIZE * sizeof(float)); out_pos += W3_SIZE;
    memcpy(&out_buf[out_pos], b3, B3_SIZE * sizeof(float)); out_pos += B3_SIZE;
    memcpy(&out_buf[out_pos], output, OUTPUT_NEURONEN * sizeof(float)); out_pos += OUTPUT_NEURONEN;

    munmap(in_buf, IN_BUF_FLOATS * sizeof(float));
    munmap(out_buf, OUT_BUF_FLOATS * sizeof(float));
    return 0;
}

// ===========================================================
// FESTES LAYOUT:
// INPUT-Buffer | float:
//   [0] = modus      0 = for / 1 = back
//   [64] = W1
//   [72] = b1
//   [136] = W2
//   [144] = b2
//   [152] = W3
//   [153] = b3
//   [161] = input_vector
//   [162] = expected if [0] == 1 else ignore
//   [163] = lernrate if [0] == 1 else ignore
// OUTPUT-Buffer | float:
//eig nur noch das was in db und oder algorytmus mit kommt
//   [63] =W1 (ggf. aktualisiert)
//   [71] = b1
//   [135] = W2
//   [143] = b2
//   [151] = W3
//   [152] = b3
//   [153] = output
// ===========================================================
#define IN_BUF_FLOATS  (1 + W1_SIZE + B1_SIZE + W2_SIZE + B2_SIZE + W3_SIZE + B3_SIZE + INPUT_SIZE + OUTPUT_NEURONEN + 1)
#define OUT_BUF_FLOATS (W1_SIZE + B1_SIZE + W2_SIZE + B2_SIZE + W3_SIZE + B3_SIZE + OUTPUT_NEURONEN)

// toolkits

float sigmurid(float x) { 
    return 1.0f / (1.0f + expf(-x)); 
}

//for Gradien descent
float sigmurid_ableitung(float x) {
    return x * (1.0f - x); 
}

void forward_step(float* W1, float* b1, float* W2, float* b2,
                   float* W3, float* b3, float* input,
                   float* h1, float* h2, float* output) {
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        float summe = 0.0f;
        for (int k = 0; k < INPUT_NEURONEN; k++) summe += W1[i * INPUT_NEURONEN + k] * input[k];
        h1[i] = sigmurid(summe + b1[i]);
    }
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        float summe = 0.0f;
        for (int k = 0; k < HIDDEN_NEURONEN; k++) summe += W2[i * HIDDEN_NEURONEN + k] * h1[k];
        h2[i] = sigmurid(summe + b2[i]);
    }
    for (int i = 0; i < OUTPUT_NEURONEN; i++) {
        float summe = 0.0f;
        for (int k = 0; k < HIDDEN_NEURONEN; k++) summe += W3[i * HIDDEN_NEURONEN + k] * h2[k];
        output[i] = sigmurid(summe + b3[i]);
    }
}

void backprop_step(float* W1, float* b1, float* W2, float* b2,
                    float* W3, float* b3, float* input,
                    float* h1, float* h2, float* output,
                    float* erwartet, float lernrate) {
    float delta_out[OUTPUT_NEURONEN];
    for (int i = 0; i < OUTPUT_NEURONEN; i++)
        delta_out[i] = (output[i] - erwartet[i]) * sigmurid_ableitung(output[i]);

    float delta_h2[HIDDEN_NEURONEN];
    for (int k = 0; k < HIDDEN_NEURONEN; k++) {
        float summe = 0.0f;
        for (int i = 0; i < OUTPUT_NEURONEN; i++) summe += W3[i * HIDDEN_NEURONEN + k] * delta_out[i];
        delta_h2[k] = summe * sigmurid_ableitung(h2[k]);
    }

    float delta_h1[HIDDEN_NEURONEN];
    for (int k = 0; k < HIDDEN_NEURONEN; k++) {
        float summe = 0.0f;
        for (int i = 0; i < HIDDEN_NEURONEN; i++) summe += W2[i * HIDDEN_NEURONEN + k] * delta_h2[i];
        delta_h1[k] = summe * sigmurid_ableitung(h1[k]);
    }

    for (int i = 0; i < OUTPUT_NEURONEN; i++) {
        for (int k = 0; k < HIDDEN_NEURONEN; k++) W3[i * HIDDEN_NEURONEN + k] -= lernrate * delta_out[i] * h2[k];
        b3[i] -= lernrate * delta_out[i];
    }
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        for (int k = 0; k < HIDDEN_NEURONEN; k++) W2[i * HIDDEN_NEURONEN + k] -= lernrate * delta_h2[i] * h1[k];
        b2[i] -= lernrate * delta_h2[i];
    }
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        for (int k = 0; k < INPUT_NEURONEN; k++) W1[i * INPUT_NEURONEN + k] -= lernrate * delta_h1[i] * input[k];
        b1[i] -= lernrate * delta_h1[i];
    }
}

// ===========================================================
// Shared Memory oeffnen (Python hat das Segment bereits ANGELEGT - hier nur
// oeffnen + in den eigenen Adressraum einblenden, NICHT neu anlegen)
// ===========================================================
float* shm_oeffnen(const char* name, size_t anzahl_floats) {
    int fd = shm_open(name, O_RDWR, 0666);
    if (fd < 0) {
        fprintf(stderr, "Fehler: konnte Shared Memory '%s' nicht oeffnen: %s\n", name, strerror(errno));
        exit(1);
    }
    float* ptr = mmap(NULL, anzahl_floats * sizeof(float), PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    close(fd);
    if (ptr == MAP_FAILED) {
        fprintf(stderr, "Fehler: mmap fehlgeschlagen fuer '%s'\n", name);
        exit(1);
    }
    return ptr;
}

// ===========================================================
// main: liest argv[1]=input_shm_name, argv[2]=output_shm_name
// (KEIN Dict, KEIN argc-basiertes "7 Parameter?" Raten - der Modus (forward
// vs. forward+backprop) steht jetzt explizit als erster Wert IM Speicher,
// weil das mit dem festen Layout zuverlaessiger ist als aus der Anzahl der
// Kommandozeilenargumente zu raten.)
// ===========================================================
