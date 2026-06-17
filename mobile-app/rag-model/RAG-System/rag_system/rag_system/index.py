import ollama
import os
import numpy as np
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import tempfile
import uuid
import json
from datetime import datetime

# Flask app setup
app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Constants for Qdrant
QDRANT_HOST = "localhost"
QDRANT_PORT = 6333
BASE_COLLECTION_NAME = "pdf_documents"

# Initialize Qdrant client
qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

# Global storage for user sessions
user_sessions = {}

class PDFChatSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.collection_name = f"{BASE_COLLECTION_NAME}_{session_id}"
        self.pdf_path = None
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.documents = []
        self.created_at = datetime.now()
    
    def load_pdf_documents(self, pdf_path):
        """Load PDF documents using PyPDFLoader"""
        loader = PyPDFLoader(pdf_path)
        return loader.load()
    
    def split_document(self, pages):
        """Split documents into chunks"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        return text_splitter.split_documents(pages)
    
    def create_qdrant_collection(self, dimension):
        """Create a new Qdrant collection for this session"""
        if qdrant_client.collection_exists(self.collection_name):
            # Delete existing collection to start fresh
            qdrant_client.delete_collection(self.collection_name)
        
        qdrant_client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE)
        )
    
    def create_vector_store(self, pdf_path):
        """Create vector store from uploaded PDF"""
        self.pdf_path = pdf_path
        
        # Load and process PDF
        pages = self.load_pdf_documents(pdf_path)
        split_docs = self.split_document(pages)
        
        # Extract texts and create embeddings
        document_texts = [doc.page_content for doc in split_docs]
        self.documents = document_texts
        embeddings = self.embedder.encode(document_texts)
        dimension = embeddings.shape[1]
        
        # Create collection
        self.create_qdrant_collection(dimension)
        
        # Prepare points for batch upload
        points = []
        for idx, embedding in enumerate(embeddings):
            point = PointStruct(
                id=idx,
                vector=embedding.tolist(),
                payload={
                    "text": document_texts[idx],
                    "page": split_docs[idx].metadata.get('page', 0),
                    "source": split_docs[idx].metadata.get('source', pdf_path)
                }
            )
            points.append(point)
        
        # Upload to Qdrant
        qdrant_client.upsert(collection_name=self.collection_name, points=points)
        
        return len(points)
    
    def retrieve_context(self, query, k=3):
        """Retrieve relevant context for a query"""
        try:
            query_embedding = self.embedder.encode([query])[0].tolist()
            search_result = qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=k,
                with_payload=True
            )
            return [
                {
                    'text': hit.payload["text"],
                    'score': hit.score,
                    'page': hit.payload.get('page', 0)
                }
                for hit in search_result
            ]
        except Exception as e:
            print(f"Error retrieving context: {e}")
            return []
    
    def generate_answer_with_ollama(self, query, context_items):
        """Generate answer using Ollama with context"""
        if not context_items:
            return "The details are not in the PDF. कृपया PDF में उपलब्ध जानकारी के बारे में पूछें।"
        
        formatted_context = "\n\n".join([item['text'] for item in context_items])
        
        prompt = f"""You are an expert assistant trained on document information.
Use this context to answer the question accurately and comprehensively.

Context from PDF:
{formatted_context}

Question: {query}

Instructions:
- Answer in detail using only the provided context
- If the question cannot be answered from the context, respond: "The details are not in the PDF."
- Provide answers in Hinglish (Hindi-English mix) when appropriate
- Include page references when possible
- Be conversational and helpful

Answer:"""

        try:
            stream = ollama.generate(
                model='deepseek-r1:1.5b',
                prompt=prompt,
                options={
                    'temperature': 0.4,
                    'max_tokens': 2000
                },
                stream=False  # Changed to False for API response
            )
            
            response = stream.get('response', '')
            
            # Add page references if available
            pages = list(set([item['page'] for item in context_items if item['page'] > 0]))
            if pages:
                response += f"\n\n(Referenced from pages: {', '.join(map(str, sorted(pages)))})"
            
            return response
            
        except Exception as e:
            print(f"Error generating answer: {e}")
            return "Sorry, I encountered an error while processing your question. कृपया दोबारा प्रयास करें।"
    
    def cleanup(self):
        """Clean up resources for this session"""
        try:
            if qdrant_client.collection_exists(self.collection_name):
                qdrant_client.delete_collection(self.collection_name)
            if self.pdf_path and os.path.exists(self.pdf_path):
                os.remove(self.pdf_path)
        except Exception as e:
            print(f"Error during cleanup: {e}")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_or_create_session(session_id=None):
    """Get existing session or create new one"""
    if session_id and session_id in user_sessions:
        return user_sessions[session_id]
    
    new_session_id = session_id or str(uuid.uuid4())
    session = PDFChatSession(new_session_id)
    user_sessions[new_session_id] = session
    return session

@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    """Handle PDF upload and processing"""
    try:
        # Check if file is present
        if 'pdf' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['pdf']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PDF files are allowed.'}), 400
        
        # Get or create session
        session_id = request.form.get('session_id')
        session = get_or_create_session(session_id)
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        file.save(filepath)
        
        # Process PDF and create vector store
        num_chunks = session.create_vector_store(filepath)
        
        response_data = {
            'success': True,
            'message': f'PDF processed successfully! Created {num_chunks} text chunks.',
            'session_id': session.session_id,
            'filename': filename,
            'chunks_created': num_chunks
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': f'Failed to process PDF: {str(e)}'}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat queries"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        query = data.get('query', '').strip()
        session_id = data.get('session_id')
        
        if not query:
            return jsonify({'error': 'No query provided'}), 400
        
        if not session_id or session_id not in user_sessions:
            return jsonify({'error': 'Invalid session. Please upload a PDF first.'}), 400
        
        session = user_sessions[session_id]
        
        if not session.documents:
            return jsonify({'error': 'No PDF processed. Please upload a PDF first.'}), 400
        
        # Retrieve context and generate answer
        context_items = session.retrieve_context(query, k=3)
        answer = session.generate_answer_with_ollama(query, context_items)
        
        response_data = {
            'answer': answer,
            'context_used': len(context_items),
            'session_id': session_id
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({'error': f'Failed to process query: {str(e)}'}), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a chat session and cleanup resources"""
    try:
        if session_id in user_sessions:
            session = user_sessions[session_id]
            session.cleanup()
            del user_sessions[session_id]
            return jsonify({'message': 'Session deleted successfully'})
        else:
            return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Failed to delete session: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'active_sessions': len(user_sessions),
        'timestamp': datetime.now().isoformat()
    })

# Cleanup old sessions periodically (you might want to implement this with a scheduler)
def cleanup_old_sessions(max_age_hours=24):
    """Clean up sessions older than max_age_hours"""
    current_time = datetime.now()
    sessions_to_delete = []
    
    for session_id, session in user_sessions.items():
        age = (current_time - session.created_at).total_seconds() / 3600
        if age > max_age_hours:
            sessions_to_delete.append(session_id)
    
    for session_id in sessions_to_delete:
        session = user_sessions[session_id]
        session.cleanup()
        del user_sessions[session_id]
        print(f"Cleaned up old session: {session_id}")

if __name__ == '__main__':
    print("Starting PDF Chat Server...")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Qdrant connection: {QDRANT_HOST}:{QDRANT_PORT}")
    
    # Test Qdrant connection
    try:
        collections = qdrant_client.get_collections()
        print("✓ Qdrant connection successful")
    except Exception as e:
        print(f"✗ Qdrant connection failed: {e}")
    
    # Test Ollama connection
    try:
        ollama.list()
        print("✓ Ollama connection successful")
    except Exception as e:
        print(f"✗ Ollama connection failed: {e}")
    
    app.run(debug=True, host='0.0.0.0', port=5000)