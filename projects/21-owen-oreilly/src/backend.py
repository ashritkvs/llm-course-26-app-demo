from flask import Flask, request, send_from_directory
import flask
import json
from flask_cors import CORS
import parse_file as ps
import zipfile
import os
import webbrowser

app = Flask(__name__, static_folder="static")
CORS(app)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# occurs in url https://localhost:8001/users
# returns data as JSON
@app.route('/pass_codebase', methods=["POST"])
def pass_codebase():
    if request.method == "POST":
        file = request.files['file']
        print(f"received data: {file.filename}")

        zfile = zipfile.ZipFile(file, 'r')

        return_data = ps.parse_codebase_zip(zfile)

        with open("/Users/albus/Desktop/Owen/2025-26/Spring26/CSE564/Codebase_Vis_Final_Project/current_return_json.json", 'w') as f:
            f.write(json.dumps(return_data, indent=4))
        
        return flask.Response(response=json.dumps(return_data), status=201)


if __name__ == "__main__":
    if not os.environ.get("WERKZEUG_RUN_MAIN"): # Prevents opening twice in debug mode
        webbrowser.open("http://127.0.0.1:8001")
    
    app.run(port=8001)