FROM mirror.gcr.io/library/python:3.12-slim
RUN pip install --no-cache-dir yt-dlp imageio-ffmpeg
COPY server.py /server.py
EXPOSE 8080
CMD ["python", "/server.py"]
