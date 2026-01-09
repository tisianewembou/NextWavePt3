import cv2
import numpy as np
import mediapipe as mp
import os

# 1. Setup MediaPipe
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

# 2. Path for exported data
DATA_PATH = os.path.join('MP_Data') 

# Define the gestures you want to detect
actions = np.array(['swipe_left', 'swipe_right', 'no_gesture'])

no_sequences = 30     # Record 30 videos per action
sequence_length = 30  # Each video is 30 frames long (approx 1 second)

# Create the folder structure
for action in actions: 
    for sequence in range(no_sequences):
        try: 
            os.makedirs(os.path.join(DATA_PATH, action, str(sequence)))
        except:
            pass

# 3. The Helper Function (The Missing Piece)
def extract_keypoints(results):
    """
    Extracts x, y, z coordinates for the RIGHT HAND only.
    Returns a flattened array of 63 values (21 points * 3 coords).
    If no hand is found, returns an array of zeros.
    """
    if results.right_hand_landmarks:
        rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten()
    else:
        rh = np.zeros(21*3) # Fill with zeros if hand not visible
    return rh

# 4. Main Collection Loop
cap = cv2.VideoCapture(0)

# Set MediaPipe model 
with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    
    # Loop through each action (swipe_left, swipe_right, etc.)
    for action in actions:
        # Loop through sequences (videos)
        for sequence in range(no_sequences):
            # Loop through video length (frames)
            for frame_num in range(sequence_length):

                # Read Feed
                ret, frame = cap.read()
                if not ret:
                    break

                # Make Detections
                image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) # Convert BGR to RGB
                image.flags.writeable = False                  # Optimize for speed
                results = holistic.process(image)              # Make prediction
                image.flags.writeable = True                   # Make writable again
                image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR) # Convert back to BGR

                # Draw landmarks on screen (Visual Feedback)
                mp_drawing.draw_landmarks(
                    image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
                
                # NEW: Wait logic to give you time to reset between videos
                if frame_num == 0: 
                    cv2.putText(image, 'STARTING COLLECTION', (120,200), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255, 0), 4, cv2.LINE_AA)
                    cv2.putText(image, 'Collecting frames for {} Video Number {}'.format(action, sequence), (15,12), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1, cv2.LINE_AA)
                    # Show to screen
                    cv2.imshow('OpenCV Feed', image)
                    cv2.waitKey(2000) # Wait 2 seconds between videos so you can reset your hand
                else: 
                    cv2.putText(image, 'Collecting frames for {} Video Number {}'.format(action, sequence), (15,12), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1, cv2.LINE_AA)
                    cv2.imshow('OpenCV Feed', image)

                # Export Keypoints
                keypoints = extract_keypoints(results)
                npy_path = os.path.join(DATA_PATH, action, str(sequence), str(frame_num))
                np.save(npy_path, keypoints)

                # Break gracefully
                if cv2.waitKey(10) & 0xFF == ord('q'):
                    break
                    
    cap.release()
    cv2.destroyAllWindows()