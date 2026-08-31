#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

#define INPUT_NEURONEN   8
#define HIDDEN_LAYER     2
#define HIDDEN_NEURONEN  8
#define OUTPUT_NURONEN   1
#define LERNRATE         0.05f

#define EXECUTE_PATH= "core/ai/manage_ai.py"

float* create_vector(float* arr, int size);
float* hidden_vector();
float* base_vector();
float** create_weigth_matix(float* weights, int matrix_height, int matrix_width);
void free_vector(float* vector);
void free_matrix(float** matrix, int matrix_height);
float* zufalls_array(int size);
float sigmurid(float x);
float mse(int N, float* erwartet, float* output);

int main(){
    EXECUTE_PATH.load_data()
}
// NNN
typedef struct {
    float** W1; float* b1;   // Input -> Hidden1
    float** W2; float* b2;   // Hidden1 -> Hidden2
    float** W3; float* b3;   // Hidden2 -> Output
} Netz;

Netz* netz_laden(const char* ordner) {
    char pfad[512];
    Netz* netz = malloc(sizeof(Netz));

    snprintf(pfad, sizeof(pfad), "%s/w1.txt", ordner);
    netz->W1 = load_or_init_weigth_matrix(pfad, HIDDEN_NEURONEN, INPUT_NEURONEN);
    snprintf(pfad, sizeof(pfad), "%s/b1.txt", ordner);
    netz->b1 = load_or_init_vector(pfad, HIDDEN_NEURONEN);

    snprintf(pfad, sizeof(pfad), "%s/w2.txt", ordner);
    netz->W2 = load_or_init_weigth_matrix(pfad, HIDDEN_NEURONEN, HIDDEN_NEURONEN);
    snprintf(pfad, sizeof(pfad), "%s/b2.txt", ordner);
    netz->b2 = load_or_init_vector(pfad, HIDDEN_NEURONEN);

    snprintf(pfad, sizeof(pfad), "%s/w3.txt", ordner);
    netz->W3 = load_or_init_weigth_matrix(pfad, OUTPUT_NURONEN, HIDDEN_NEURONEN);
    snprintf(pfad, sizeof(pfad), "%s/b3.txt", ordner);
    netz->b3 = load_or_init_vector(pfad, OUTPUT_NURONEN);

    return netz;
}

void netz_speichern(Netz* netz, const char* ordner) {
    char pfad[512];
    snprintf(pfad, sizeof(pfad), "%s/w1.txt", ordner); save_weigth_matrix(netz->W1, HIDDEN_NEURONEN, INPUT_NEURONEN, pfad);
    snprintf(pfad, sizeof(pfad), "%s/b1.txt", ordner); save_vector(netz->b1, HIDDEN_NEURONEN, pfad);
    snprintf(pfad, sizeof(pfad), "%s/w2.txt", ordner); save_weigth_matrix(netz->W2, HIDDEN_NEURONEN, HIDDEN_NEURONEN, pfad);
    snprintf(pfad, sizeof(pfad), "%s/b2.txt", ordner); save_vector(netz->b2, HIDDEN_NEURONEN, pfad);
    snprintf(pfad, sizeof(pfad), "%s/w3.txt", ordner); save_weigth_matrix(netz->W3, OUTPUT_NURONEN, HIDDEN_NEURONEN, pfad);
    snprintf(pfad, sizeof(pfad), "%s/b3.txt", ordner); save_vector(netz->b3, OUTPUT_NURONEN, pfad);
    printf("Gewichte/Biases gespeichert in: %s\n", ordner);
}

void netz_freigeben(Netz* netz) {
    free_matrix(netz->W1, HIDDEN_NEURONEN); free_vector(netz->b1);
    free_matrix(netz->W2, HIDDEN_NEURONEN); free_vector(netz->b2);
    free_matrix(netz->W3, OUTPUT_NURONEN);  free_vector(netz->b3);
    free(netz);
}

void forward(Netz* netz, float* input, float** out_h1, float** out_h2, float** out_output) {
    float* z1 = matrix_mal_vektor(netz->W1, HIDDEN_NEURONEN, INPUT_NEURONEN, input);
    float* z1b = vektor_addieren(z1, netz->b1, HIDDEN_NEURONEN);
    *out_h1 = vektor_sigmurid(z1b, HIDDEN_NEURONEN);
    free_vector(z1); free_vector(z1b);

    float* z2 = matrix_mal_vektor(netz->W2, HIDDEN_NEURONEN, HIDDEN_NEURONEN, *out_h1);
    float* z2b = vektor_addieren(z2, netz->b2, HIDDEN_NEURONEN);
    *out_h2 = vektor_sigmurid(z2b, HIDDEN_NEURONEN);
    free_vector(z2); free_vector(z2b);

    float* z3 = matrix_mal_vektor(netz->W3, OUTPUT_NURONEN, HIDDEN_NEURONEN, *out_h2);
    float* z3b = vektor_addieren(z3, netz->b3, OUTPUT_NURONEN);
    *out_output = vektor_sigmurid(z3b, OUTPUT_NURONEN);
    free_vector(z3); free_vector(z3b);
}
void backprop(Netz* netz, float* input, float* h1, float* h2, float* output,
              float* erwartet, float lernrate) {

    // Fehler an der Ausgabeschicht: delta = (output - erwartet) * sigmurid'(output)
    float delta_out[OUTPUT_NURONEN];
    for (int i = 0; i < OUTPUT_NURONEN; i++) {
        delta_out[i] = (output[i] - erwartet[i]) * sigmurid_ableitung(output[i]);
    }

    // Fehler zurueck in Hidden-Layer 2: delta_h2 = (W3^T * delta_out) * sigmurid'(h2)
    float delta_h2[HIDDEN_NEURONEN];
    for (int k = 0; k < HIDDEN_NEURONEN; k++) {
        float summe = 0.0f;
        for (int i = 0; i < OUTPUT_NURONEN; i++) summe += netz->W3[i][k] * delta_out[i];
        delta_h2[k] = summe * sigmurid_ableitung(h2[k]);
    }

    // Fehler zurueck in Hidden-Layer 1: delta_h1 = (W2^T * delta_h2) * sigmurid'(h1)
    float delta_h1[HIDDEN_NEURONEN];
    for (int k = 0; k < HIDDEN_NEURONEN; k++) {
        float summe = 0.0f;
        for (int i = 0; i < HIDDEN_NEURONEN; i++) summe += netz->W2[i][k] * delta_h2[i];
        delta_h1[k] = summe * sigmurid_ableitung(h1[k]);
    }

    // Gewichte W3, Bias b3 aktualisieren
    for (int i = 0; i < OUTPUT_NURONEN; i++) {
        for (int k = 0; k < HIDDEN_NEURONEN; k++) {
            netz->W3[i][k] -= lernrate * delta_out[i] * h2[k];
        }
        netz->b3[i] -= lernrate * delta_out[i];
    }

    // Gewichte W2, Bias b2 aktualisieren
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        for (int k = 0; k < HIDDEN_NEURONEN; k++) {
            netz->W2[i][k] -= lernrate * delta_h2[i] * h1[k];
        }
        netz->b2[i] -= lernrate * delta_h2[i];
    }

    // Gewichte W1, Bias b1 aktualisieren
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        for (int k = 0; k < INPUT_NEURONEN; k++) {
            netz->W1[i][k] -= lernrate * delta_h1[i] * input[k];
        }
        netz->b1[i] -= lernrate * delta_h1[i];
    }
}

// ============================================================================
// main(): zeigt den kompletten Zyklus laden -> forward -> backprop -> speichern
// ============================================================================
int main() {
    srand((unsigned int) time(NULL));

    const char* ordner = "./weights_v2";
    Netz* netz = netz_laden(ordner);

    // Beispiel-Input: 8 normalisierte Naehrwert-Features (0..1)
    float input[INPUT_NEURONEN] = {0.3f, 0.5f, 0.9f, 0.6f, 0.1f, 0.4f, 0.2f, 0.7f};

    // Ziel: Health-Score normalisiert auf 0..1 (spaeter *100 fuer 1-100-Skala)
    float erwartet[OUTPUT_NURONEN] = {0.15f};

    float *h1, *h2, *output;
    forward(netz, input, &h1, &h2, &output);

    printf("Vorhersage vor Training: %.4f (Ziel: %.4f)\n", output[0], erwartet[0]);
    printf("MSE vor Training: %.6f\n", mse(OUTPUT_NURONEN, erwartet, output));

    backprop(netz, input, h1, h2, output, erwartet, LERNRATE);

    free_vector(h1); free_vector(h2); free_vector(output);
    forward(netz, input, &h1, &h2, &output);
    printf("Vorhersage nach 1 Trainingsschritt: %.4f\n", output[0]);
    printf("MSE nach 1 Trainingsschritt: %.6f\n", mse(OUTPUT_NURONEN, erwartet, output));

    netz_speichern(netz, ordner);

    free_vector(h1); free_vector(h2); free_vector(output);
    netz_freigeben(netz);

    return 0;
}

// save logic
float* load_vector(const char* filename, int* out_size) {
    FILE* f = fopen(filename, "r");
    if (!f) return NULL;
    int size;
    fscanf(f, "%d", &size);
    float* vector = malloc(size * sizeof(float));
    for (int i = 0; i < size; i++) fscanf(f, "%f", &vector[i]);
    fclose(f);
    *out_size = size;
    return vector;
}
void save_vector(float* vector, int size) {
  EXECUTE_PATH.save_data(vector, size);
}

// toolkit !!
// Vector and Matritzen
float* create_vector(float* arr, int size) {
    float* vector = malloc(size * sizeof(float));
    for (int i = 0; i < size; i++) {
        vector[i] = arr[i];
    }
    return vector;
}

float* hidden_vector() {
    float neuronen[HIDDEN_NEURONEN];
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        neuronen[i] = 18;
    }
    return create_vector(neuronen, HIDDEN_NEURONEN);
}

float* base_vector() {
    float neuronen[HIDDEN_NEURONEN];
    for (int i = 0; i < HIDDEN_NEURONEN; i++) {
        neuronen[i] = 1;
    }
    return create_vector(neuronen, HIDDEN_NEURONEN);
}

float** create_weigth_matix(float* weights, int matrix_height, int matrix_width) {
    float** weight_matrix = malloc(matrix_height * sizeof(float*));
    int count = 0;
    for (int i = 0; i < matrix_height; i++) {
        weight_matrix[i] = malloc(matrix_width * sizeof(float));
        for (int k = 0; k < matrix_width; k++) {
            weight_matrix[i][k] = weights[count];
            count++;
        }
    }
    return weight_matrix;
}

void free_vector(float* vector) {
    free(vector);
}

void free_matrix(float** matrix, int matrix_height) {
    for (int i = 0; i < matrix_height; i++) free(matrix[i]);
    free(matrix);
}
// Hilfsfunktion: erzeugt ein Array mit zufaelligen Startwerten
// -> randome zuweisung
float* zufalls_array(int size) {
    float* arr = malloc(size * sizeof(float));
    for (int i = 0; i < size; i++) {
        arr[i] = ((float) rand() / RAND_MAX) - 0.5f;
    }
    return arr;
}
// sigmurid
float sigmurid(float x){
    return 1.0f / (1.0f + expf(-x));
}

// Error Function
float mse(int N, float* erwartet, float* output) {
    float complete_error = 0;
    for (int i = 0; i < N; i++) {
        float diff = output[i] - erwartet[i];
        complete_error += diff * diff;
    }
    return complete_error / N;
}
