import cv2
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import time
import threading
import os
import datetime

# --- Configuration ---
# Directory to temporarily save the video file on the server
OUTPUT_DIR = 'presentation_recordings'
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# Initialize Flask app
app = Flask(__name__)
# Enable CORS for frontend 
CORS(app)

# --- Global State ---
recording_active = False
camera = None
out = None  # cv2.VideoWriter object
output_filename = None
recording_thread = None

# --- Camera Utilities ---

def get_camera():
    """Initializes and returns the OpenCV VideoCapture object."""
    global camera
    if camera is None:
        # Use 0 default camera
        camera = cv2.VideoCapture(0)
        
        if not camera.isOpened():
            print("Error: Could not open video stream.")
            return None
    return camera

def release_camera():
    """Releases the camera resource."""
    global camera
    if camera:
        camera.release()
        camera = None
        print("Camera released.")

# --- Recording Logic Sequence ---

def record_frames():
    """Reads frames from the camera and writes them to the video file in a separate thread."""
    global recording_active, camera, out
    
    if camera is None or out is None:
        print("Error: Camera or VideoWriter not initialized.")
        return

    # Give the camera a moment to warm up
    time.sleep(0.5)

    print("Recording thread started.")
    # Loop while the global flag is set to True
    while recording_active:
        # Read a frame
        ret, frame = camera.read()
        
        if ret:
            # Write the frame to the video file
            out.write(frame)
        else:
            print("Warning: Could not read frame from camera.")
            time.sleep(0.1) # Avoid tight loop on failure

# --- Flask Routes ---

@app.route('/start_recording', methods=['POST'])
def start_recording():
    """Endpoint called by the frontend to initiate server-side recording."""
    global recording_active, camera, out, output_filename, recording_thread

    if recording_active:
        return jsonify({"success": False, "message": "Recording already active."}), 409

    camera = get_camera()
    if camera is None:
        return jsonify({"success": False, "message": "Failed to access camera resource."}), 500

    # Get frame properties for VideoWriter
    frame_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = camera.get(cv2.CAP_PROP_FPS) or 20.0 # Default to 20 FPS if camera doesn't provide it

    # Define the output file path and name
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = os.path.join(OUTPUT_DIR, f"presentation_recording_{timestamp}.mp4")
    

    fourcc = cv2.VideoWriter_fourcc(*'XVID') 
    
    out = cv2.VideoWriter(output_filename, fourcc, fps, (frame_width, frame_height))

    # Start the recording thread
    recording_active = True
    recording_thread = threading.Thread(target=record_frames)
    recording_thread.start()
    
    print(f"Recording thread started. Saving to: {output_filename}")
    
    return jsonify({"success": True, "message": "Recording initiated successfully."})

@app.route('/stop_recording', methods=['POST'])
def stop_recording():
    """Endpoint to stop the server-side recording and finalize the file."""
    global recording_active, out, recording_thread, output_filename
    
    if not recording_active:
        return jsonify({"success": False, "message": "No active recording to stop."}), 400
    
    # 1. Stop the loop
    recording_active = False
    
    # 2. Wait for the recording thread to finish writing the last frame
    if recording_thread and threading.current_thread() != recording_thread:
        recording_thread.join()
    
    # 3. Release the VideoWriter to finalize the file
    if out:
        out.release()
        out = None
    
    # 4. Release the camera resource (optional)
    release_camera() 
    
    print(f"Video recording stopped and file finalized: {output_filename}")
    
    return jsonify({
        "success": True, 
        "message": "Recording stopped and file saved.", 
        "filepath": output_filename 
    })

@app.route('/download_video', methods=['GET'])
def download_video():
    """Endpoint to serve the saved video file for client download."""
    global output_filename
    
    if output_filename and os.path.exists(output_filename):
        # send_file uses as_attachment=True to force the browser to download the file
        print(f"Serving file for download: {output_filename}")
        return send_file(output_filename, as_attachment=True)
    
    return jsonify({"success": False, "message": "Video file not found or recording not complete."}), 404

@app.teardown_appcontext
def shutdown_session(exception=None):
    """Ensure resources are released when the Flask app shuts down."""
    global out
    if out:
        out.release()
    release_camera()

if __name__ == '__main__':
    print("Starting Flask Backend...")
    print("WARNING: Video files will be saved in the 'presentation_recordings' directory on the server.")
    # Run on port 5000, which the React frontend expects
    app.run(host='0.0.0.0', port=5000, threaded=True)