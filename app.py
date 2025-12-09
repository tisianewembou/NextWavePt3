import os
import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename

# --- Configuration ---
# Directory to store the recorded video files
OUTPUT_DIR = 'client_recordings'
ALLOWED_EXTENSIONS = {'webm', 'mp4', 'ogg'}

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# --- Utility Functions ---

def allowed_file(filename):
    """Checks if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Flask Routes ---

@app.route('/', methods=['GET'])
def home():
    """Serves the frontend HTML."""
    return render_template('index.html')

@app.route('/upload_video', methods=['POST'])
def upload_video():
    """Endpoint to receive the recorded video file."""
    
    if 'video' not in request.files:
        return jsonify({"success": False, "message": "No video file part in the request."}), 400

    video_file = request.files['video']
    
    if video_file.filename == '':
        return jsonify({"success": False, "message": "No selected file."}), 400

    filename = secure_filename(video_file.filename)
    
    if not allowed_file(filename):
        return jsonify({"success": False, "message": "File type not allowed. Must be webm, mp4, or ogg."}), 400
    
    # Generate a unique save filename
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = os.path.splitext(filename)[1]
    save_filename = os.path.join(OUTPUT_DIR, f"client_recording_{timestamp}{ext}")
    
    try:
        video_file.save(save_filename)
        print(f"Client video uploaded and saved as: {save_filename}")
        
        return jsonify({
            "success": True, 
            "message": "Video successfully uploaded and saved on the server.",
            "filename": os.path.basename(save_filename)
        })
    except Exception as e:
        print(f"Error saving file: {e}")
        return jsonify({"success": False, "message": f"Server error during save: {e}"}), 500

if __name__ == '__main__':
    print("Starting Flask Backend...")
    print(f"WARNING: Video files will be saved in the '{OUTPUT_DIR}' directory.")
    app.run(host='0.0.0.0', port=5000, threaded=True)