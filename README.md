# Rebuild

Rebuild is a personal wellness tracking app for sleep, nutrition, activity, daily check-ins, and calendar planning. It includes Opty, an AI assistant powered by Ollama.

## Quick start

Requirements: Docker with Compose and Bash.

```bash
bash start.sh
```

On first run, the script creates a local `.env` with a random session secret, builds the app, starts Ollama, selects and downloads a model if needed, and launches the application.

Open [http://localhost:8000](http://localhost:8000). The Ollama service is available to the app at `http://ollama:11434`.

## Documentation

- [Application overview and setup notes](docs/README.md)
- [Architecture guides by feature](docs/architecture/README.md)

The documentation describes the current implementation and its limitations. It is not a medical or API specification.
