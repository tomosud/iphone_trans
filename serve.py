"""Local preview server for dist/.

Same as `python -m http.server`, but serves .mjs and .wasm with the right
MIME types (on Windows, http.server takes .mjs as text/plain from the
registry, and browsers refuse to import it as a module).
"""
import functools
import http.server
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm"})
http.server.test(HandlerClass=functools.partial(Handler, directory="dist"), port=port, bind="127.0.0.1")
