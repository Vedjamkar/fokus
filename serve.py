# Serves Study Haven at http://localhost:5173 with caching off, so edits show up on reload.
# Keep the port fixed: your saved data belongs to this exact address.
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
print(f"Study Haven → http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
