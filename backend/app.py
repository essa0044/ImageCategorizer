# backend/app.py
from flask import Flask, jsonify, request, send_from_directory
import os
from dotenv import load_dotenv
import fitz # PyMuPDF
import psycopg2 # PostgreSQL Adapter
import logging
import uuid # For unique filenames
import shutil # For file operations
from PIL import Image # For image cropping

load_dotenv()

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
# Ensure the base upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

logging.basicConfig(level=logging.INFO)

# --- db-connection helper ---
def get_db_connection():
    """ Connects to Postgres-Database. """
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'db'),
            database=os.getenv('POSTGRES_DB'), # Use POSTGRES_DB consistently
            user=os.getenv('POSTGRES_USER'),
            password=os.getenv('POSTGRES_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        return conn
    except psycopg2.OperationalError as e:
        logging.error(f"Database connection failed: {e}")
        return None

# --- API Endpoints ---

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """ Load Categories from Database. """
    # (No changes needed from your version)
    categories = []
    conn = get_db_connection()
    if conn is None:
        print("Database connection failed") # Consider using logging consistently
        return jsonify({"error": "Database connection failed"}), 500
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, color FROM public.category ORDER BY name;")
            rows = cur.fetchall()
            for row in rows:
                categories.append({"id": row[0], "name": row[1], "color": row[2]})
    except psycopg2.Error as e:
        logging.error(f"Database query failed: {e}")
        return jsonify({"error": "Failed to retrieve categories"}), 500
    finally:
        if conn:
            conn.close()
    return jsonify(categories)

@app.route('/api/upload', methods=['POST'])
def handle_upload():
    """ Processes File Uploads, converts PDFs to PNGs, saves with temp unique name. """
    # (Modified to use UUID for temp name and return original_filename)
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    original_filename = file.filename
    temp_output_filename = ""
    image_url = ""

    try:
        file_ext = os.path.splitext(original_filename)[1].lower()
        temp_filename_base = str(uuid.uuid4()) # Generate UUID for temp name

        if file_ext == '.pdf':
            temp_output_filename = temp_filename_base + ".png"
            pdf_doc = fitz.open(stream=file.read(), filetype="pdf")
            page = pdf_doc.load_page(0)
            pix = page.get_pixmap()
            output_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_output_filename)
            pix.save(output_path)
            pdf_doc.close()
            logging.info(f"Converted '{original_filename}' to temporary '{temp_output_filename}'")
        elif file_ext in ['.png', '.jpg', '.jpeg']:
            temp_output_filename = temp_filename_base + file_ext
            output_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_output_filename)
            file.save(output_path)
            logging.info(f"Saved image '{original_filename}' as temporary '{temp_output_filename}'")
        else:
            return jsonify({"error": "Unsupported file type"}), 400

        # URL uses the temporary unique name
        image_url = f"/api/images/{temp_output_filename}"

        response_data = {
            "message": "File processed successfully",
            "image_url": image_url, # URL with temp name
            "original_filename": original_filename # Pass original name back
        }
        return jsonify(response_data), 200

    except Exception as e:
        logging.exception(f"Error processing file {original_filename}")
        return jsonify({"error": "Failed to process file"}), 500


@app.route('/api/images/<path:filename>')
def serve_image(filename):
    """ Serves images from UPLOAD_FOLDER, handling potential subdirectories. """
    # (Modified to handle potential path issues and check existence better)
    # Basic security check
    if ".." in filename or filename.startswith("/"):
        logging.warning(f"Attempted invalid image path access: {filename}")
        return jsonify({"error": "Invalid path"}), 400

    # Construct the absolute path
    abs_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    # Check if the file exists using the absolute path
    if not os.path.isfile(abs_path):
        logging.error(f"Image file not found at: {abs_path}")
        return jsonify({"error": "Image not found"}), 404

    # Use send_from_directory with the base UPLOAD_FOLDER and the potentially nested filename
    logging.info(f"Serving image: {filename} from base {app.config['UPLOAD_FOLDER']}")
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=False)
    except FileNotFoundError: # Should be caught above, but as fallback
         logging.error(f"Image not found during send_from_directory: {abs_path}")
         return jsonify({"error": "Image not found"}), 404

@app.route('/api/auto-classify', methods=['POST'])
def auto_classify():
     # (Dummy implementation remains, ensure IDs are strings)
    data = request.json
    image_url = data.get('image_url')
    logging.info(f"Auto-classifying image: {image_url}")
    dummy_rects = [
        {"id": f"auto-rect-{uuid.uuid4()}", "x": 50, "y": 50, "width": 100, "height": 80, "categoryId": 1, "hierarchy": "1"},
        {"id": f"auto-rect-{uuid.uuid4()}", "x": 200, "y": 100, "width": 150, "height": 60, "categoryId": 2, "hierarchy": "2.1"}
    ]
    return jsonify({"rectangles": dummy_rects, "autoClassified": True}), 200


# --- IMPLEMENTED Submit Endpoint ---
@app.route('/api/submit', methods=['POST'])
def submit_classification():
    """
    Receives classification data (image identifier url, original filename, rectangles),
    creates exam record, crops images, saves data to DB.
    """
    data = request.json
    image_identifier_url = data.get('image_url') # e.g., "/api/images/uuid-temp-name.png"
    rectangles_data = data.get('rectangles')
    original_filename = data.get('original_filename', 'unknown_original_file') # Get original name back

    if not image_identifier_url or not isinstance(rectangles_data, list):
        logging.warning("Submit request missing image_url or rectangles.")
        return jsonify({"error": "Missing image identifier or rectangles data"}), 400

    processed_temp_filename = os.path.basename(image_identifier_url)
    source_image_path = os.path.join(app.config['UPLOAD_FOLDER'], processed_temp_filename)

    # Verify the temporary image exists before proceeding
    if not os.path.isfile(source_image_path):
        logging.error(f"Source image not found for submit at: {source_image_path}")
        return jsonify({"error": "Processed image not found on server for submission"}), 404

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    new_exam_id = None

    try:
        cursor = conn.cursor()

        # --- 1. Create Exam Record ---
        sql_insert_exam = """
            INSERT INTO exam (original_filename, processed_image_path)
            VALUES (%s, %s) RETURNING id;
        """
        # Insert with placeholder path (temp filename) initially
        cursor.execute(sql_insert_exam, (original_filename, processed_temp_filename))
        new_exam_id = cursor.fetchone()[0]
        logging.info(f"Created new exam record with ID: {new_exam_id}")

        # --- 2. Create Exam-Specific Directory ---
        exam_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(new_exam_id))
        os.makedirs(exam_dir, exist_ok=True)

        # --- 3. Move/Copy Processed Image ---
        file_ext = os.path.splitext(processed_temp_filename)[1]
        final_image_name = f"image{file_ext}" # Keep original extension
        final_image_path_abs = os.path.join(exam_dir, final_image_name)
        final_image_db_path = os.path.join(str(new_exam_id), final_image_name) # Relative path for DB

        try:
            shutil.move(source_image_path, final_image_path_abs)
            logging.info(f"Moved image to {final_image_path_abs}")
        except Exception as move_err:
            logging.warning(f"Could not move source image {source_image_path}, attempting copy: {move_err}")
            try:
                shutil.copy2(source_image_path, final_image_path_abs)
                logging.info(f"Copied image to {final_image_path_abs}")
                # Try removing source after copy
                try: os.remove(source_image_path)
                except OSError as rm_err: logging.warning(f"Could not remove source image {source_image_path} after copy: {rm_err}")
            except Exception as copy_err:
                 logging.error(f"Failed to copy image {source_image_path} to {final_image_path_abs}: {copy_err}")
                 # If copy fails, we cannot proceed with cropping etc.
                 conn.rollback() # Rollback exam insert
                 return jsonify({"error": "Failed to move or copy processed image"}), 500


        # --- 4. Update Exam Record with final path ---
        sql_update_exam_path = "UPDATE exam SET processed_image_path = %s WHERE id = %s;"
        cursor.execute(sql_update_exam_path, (final_image_db_path, new_exam_id))

        # --- 5. Load Image for Cropping ---
        try:
             img = Image.open(final_image_path_abs)
             img_width, img_height = img.size
        except Exception as img_err:
             logging.error(f"Failed to open final image {final_image_path_abs} for cropping: {img_err}")
             conn.rollback()
             return jsonify({"error": "Failed to load final image for processing"}), 500


        # --- 6. Process Rectangles ---
        sql_insert_rect = """
            INSERT INTO classified_rectangle
            (exam_id, rect_index, category_id, hierarchy, x_coord, y_coord, width, height, cropped_image_path, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        processed_count = 0
        for idx, rect_data in enumerate(rectangles_data):
            try:
                category_id = rect_data.get('categoryId') # Allow null if uncategorized
                x = float(rect_data['x'])
                y = float(rect_data['y'])
                w = float(rect_data['width'])
                h = float(rect_data['height'])
                hierarchy = rect_data.get('hierarchy', '')
                source = rect_data.get('source', 'manual') # Assume manual unless specified

                current_rect_index = idx + 1

                # --- Crop ---
                left = max(0, round(x))
                upper = max(0, round(y))
                right = min(img_width, round(x + w))
                lower = min(img_height, round(y + h))

                if right <= left or lower <= upper:
                     logging.warning(f"Skipping rect index {current_rect_index} for exam {new_exam_id} due to invalid dimensions.")
                     continue

                crop_box = (left, upper, right, lower)
                cropped_img = img.crop(crop_box)

                # --- Save Crop ---
                cropped_filename = f"crop_{current_rect_index}.png"
                cropped_filepath_abs = os.path.join(exam_dir, cropped_filename)
                cropped_db_path = os.path.join(str(new_exam_id), cropped_filename) # Relative DB path

                cropped_img.save(cropped_filepath_abs, "PNG")

                # --- Insert Record ---
                # Ensure category_id is None if it's not provided or invalid
                db_category_id = int(category_id) if category_id is not None else None

                cursor.execute(sql_insert_rect, (
                    new_exam_id, current_rect_index, db_category_id, hierarchy,
                    x, y, w, h, cropped_db_path, source
                ))
                processed_count += 1

            except (TypeError, ValueError, KeyError) as data_err:
                 logging.warning(f"Skipping rectangle index {idx+1} for exam {new_exam_id} due to invalid/missing data: {rect_data}, Error: {data_err}")
                 continue
            except Exception as proc_err:
                logging.error(f"Error processing rectangle index {idx+1} for exam {new_exam_id}: {proc_err}")


        # --- 7. Commit and Close ---
        conn.commit()
        logging.info(f"Successfully submitted classification for exam ID: {new_exam_id} with {processed_count}/{len(rectangles_data)} rectangles processed.")
        final_image_frontend_url = f"/api/images/{final_image_db_path}"
        return jsonify({
            "message": "Classification submitted successfully",
            "examId": new_exam_id,
            "final_image_url": final_image_frontend_url # URL to the image in its final location
            }), 200

    except Exception as e:
        if conn: conn.rollback()
        logging.exception("Error during submit process") # Log full traceback
        return jsonify({"error": f"Submission failed: {e}"}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


if __name__ == '__main__':
    db_host = os.getenv('DB_HOST', 'db')
    db_name = os.getenv('POSTGRES_DB', 'examdb') # Corrected DB env var name
    logging.info(f"Backend starting. Attempting to connect to DB: {db_name} on host {db_host}")
    app.run(debug=True, host='0.0.0.0', port=5001)