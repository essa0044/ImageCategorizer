# backend/app.py
from flask import Flask, jsonify, request, send_from_directory
import os
from dotenv import load_dotenv
import fitz # PyMuPDF
import psycopg2 # PostgreSQL Adapter
import logging # for better logs

load_dotenv() # loads environment-variables aus .env (important for db-credentials)

app = Flask(__name__)

# --- config ---
# directory for uploaded and converted files
UPLOAD_FOLDER = 'uploads'
# make sure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# configure logging
logging.basicConfig(level=logging.INFO)

# --- db-connection helper ---
def get_db_connection():
    """ Connects to Postgres-Database. """
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'db'), # 'db' is the Service-Name from docker-compose.yml
            database=os.getenv('POSTGRES_DB'),
            user=os.getenv('POSTGRES_USER'),
            password=os.getenv('POSTGRES_PASSWORD'),
            port=os.getenv('DB_PORT', '5432') # default PostgreSQL Port
        )
        return conn
    except psycopg2.OperationalError as e:
        logging.error(f"Database connection failed: {e}")
        return None

# --- API Endpoints ---

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """ Load Categories from Database. """
    categories = []
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        with conn.cursor() as cur:
            # pull category-category here if needed later on
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

    return jsonify(categories) # returns the categories as JSON

@app.route('/api/upload', methods=['POST'])
def handle_upload():
    """ Processes File Uploads, converts PDFs to PNGs. """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    classify_on_upload = request.form.get('classifyOnUpload') == 'true' # Checkbox Value
    original_filename = file.filename
    output_filename = ""
    image_url = ""

    try:
        # Check File-endings
        if original_filename.lower().endswith('.pdf'):
            # PDF processing with PyMuPDF
            pdf_doc = fitz.open(stream=file.read(), filetype="pdf")
            # Nur die erste Seite konvertieren (oder Loop für alle Seiten)
            page = pdf_doc.load_page(0)
            pix = page.get_pixmap()
            # generate unique filename for the output image
            output_filename = os.path.splitext(original_filename)[0] + ".png"
            output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
            pix.save(output_path)
            pdf_doc.close()
            logging.info(f"Converted '{original_filename}' to '{output_filename}'")

        elif original_filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            # save image directly to the upload folder
            output_filename = original_filename # edit filename if needed
            output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
            file.save(output_path)
            logging.info(f"Saved image '{original_filename}'")
        else:
            return jsonify({"error": "Unsupported file type"}), 400

        # generate URL, so the frontend can access the image
        # uses '/api/images/<filename>' route
        image_url = f"/api/images/{output_filename}"

        # return with image URL and success message
        response_data = {
             "message": "File processed successfully",
             "image_url": image_url
        }

        # if ClassifyOnUpload is set, start logic here (or in Frontend)
        # currently only returning Image URL so Frontend can call /api/auto-classify 
        # if classify_on_upload:
        #    trigger_auto_classification(image_url) # Hypothetical function

        return jsonify(response_data), 200

    except Exception as e:
        logging.error(f"Error processing file {original_filename}: {e}")
        return jsonify({"error": "Failed to process file"}), 500


@app.route('/api/images/<path:filename>')
def serve_image(filename):
    """ returns images from upload folder. """
    # 'path:' converter allows slashes in filename
    logging.info(f"Serving image: {filename} from {app.config['UPLOAD_FOLDER']}")
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/auto-classify', methods=['POST'])
def auto_classify():
    data = request.json
    image_url = data.get('image_url')
    logging.info(f"Auto-classifying image: {image_url}")
    # here reinforcement learning or other logic would be implemented
    dummy_rects = [
        {"id": "rect1", "x": 50, "y": 50, "width": 100, "height": 80, "categoryId": 1, "hierarchy": "1"}, # Category ID from DB
        {"id": "rect2", "x": 200, "y": 100, "width": 150, "height": 60, "categoryId": 2, "hierarchy": "2.1"} # Category ID from DB
    ]
    return jsonify({"rectangles": dummy_rects, "autoClassified": True}), 200

@app.route('/api/submit', methods=['POST'])
def submit_classification():
    # TODO: Implement database saving logic here
    data = request.json
    logging.info("Received submission data:")
    logging.info(data)
    # Implement Here: Save data in database (crop image + save info)
    return jsonify({"message": "Classification submitted successfully"}), 200

if __name__ == '__main__':
    # Load environment variables for DB from .env (Flask does this partly automatically)
    db_host = os.getenv('DB_HOST')
    db_name = os.getenv('POSTGRES_DB')
    logging.info(f"Backend starting. Attempting to connect to DB: {db_name} on host {db_host}")
    app.run(debug=True, host='0.0.0.0', port=5001)