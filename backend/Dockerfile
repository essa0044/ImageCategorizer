FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    # add any other dependencies you need here
    # e.g. poppler-utils for pdf2image
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# create a folder for Uploads
RUN mkdir /uploads
EXPOSE 5001
CMD ["flask", "run", "--host=0.0.0.0", "--port=5001"]
# for production: CMD ["gunicorn", "-w 4", "-b 0.0.0.0:5001", "app:app"]