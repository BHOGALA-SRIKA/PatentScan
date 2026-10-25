from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from sentence_transformers import SentenceTransformer

HOST = "127.0.0.1"
PORT = 8001

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

print("Loading embedding model...", flush=True)
model = SentenceTransformer(MODEL_NAME)
print("Embedding model loaded.", flush=True)


class EmbeddingHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/embed":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length))

            query = data.get("text", "").strip()

            if not query:
                self.send_error(400, "Text is required")
                return

            embedding = model.encode(
                query,
                normalize_embeddings=True
            ).tolist()

            response = json.dumps({
                "embedding": embedding,
                "dimensions": len(embedding)
            }).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        except Exception as error:
            print(f"Embedding error: {error}", flush=True)
            self.send_error(500, "Could not generate embedding")

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}", flush=True)


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), EmbeddingHandler)
    print(f"Embedding service running at http://{HOST}:{PORT}", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping embedding service.")
        server.server_close()