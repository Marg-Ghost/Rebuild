#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

#define INPUT_NEURONEN   8
#define HIDDEN_LAYER     2
#define HIDDEN_NEURONEN  8
#define OUTPUT_NURONEN   1
#define LERNRATE         0.05f

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

}
// NNN

void save_vector(float* vector, int size, const char* filename) {
    
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
