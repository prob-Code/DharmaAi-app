import ollama
import os
import numpy as np
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance

# Constants for Qdrant
QDRANT_COLLECTION = "pdf_documents"
QDRANT_HOST = "localhost"
QDRANT_PORT = 6333

# Document storage file (only texts)
DOCS_FILE = "documents.npy"

# Initialize Qdrant client
qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

def load_pdf_documents(pdf_path):
    loader = PyPDFLoader(pdf_path)
    return loader.load()

def split_document(pages):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    return text_splitter.split_documents(pages)

def create_qdrant_collection(dimension):
    # This function creates a collection if it doesn't already exist
    if not qdrant_client.collection_exists(QDRANT_COLLECTION):
        qdrant_client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE)
        )

def create_vector_store(split_docs):
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
    document_texts = [doc.page_content for doc in split_docs]
    embeddings = embedder.encode(document_texts)
    dimension = embeddings.shape[1]

    # Create collection if not exists
    create_qdrant_collection(dimension)

    # Prepare points for batch upload
    points = []
    for idx, embedding in enumerate(embeddings):
        point = PointStruct(
            id=idx,
            vector=embedding.tolist(),
            payload={"text": document_texts[idx]}
        )
        points.append(point)

    # Upsert points to Qdrant (adds/replaces previous data)
    qdrant_client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    print(f"Uploaded {len(points)} vectors to Qdrant collection '{QDRANT_COLLECTION}'.")

    # Save texts locally as backup
    np.save(DOCS_FILE, document_texts)
    
    return embedder

def load_vector_store():
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
    document_texts = np.load(DOCS_FILE, allow_pickle=True).tolist()
    
    # Check if the collection and its dimensions exist
    collection_info = qdrant_client.get_collection(collection_name=QDRANT_COLLECTION)
    dimension = collection_info.config.params.vectors.size
    
    return embedder, document_texts

def retrieve_context(query, embedder, k=3):
    query_embedding = embedder.encode([query])[0].tolist()
    search_result = qdrant_client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=query_embedding,
        limit=k,
        with_payload=True
    )
    return [hit.payload["text"] for hit in search_result]

def generate_answer_with_ollama(query, context):
    formatted_context = "\n".join(context)

    prompt = f"""You are an expert assistant trained on document information.
Use this context to answer the question:

{formatted_context}

Question: {query}
Answer in detail using only the provided context. If the question is not in the context, then answer: 'The details are not in the Pdf.' and also Give the ANswer in the HInglish"""

    stream = ollama.generate(
        model='deepseek-r1:1.5b',
        prompt=prompt,
        options={
            'temperature': 0.4,
            'max_tokens': 2000
        },
        stream=True
    )

    full_response = ""
    for chunk in stream:
        content = chunk.get("response", "")
        print(content, end="", flush=True)
        full_response += content

    print()
    return full_response

def main(pdf_path, query):
    if os.path.exists(DOCS_FILE):
        print("Loading existing vector store...")
        embedder, _ = load_vector_store()
    else:
        print("Creating new vector store...")
        pages = load_pdf_documents(pdf_path)
        split_docs = split_document(pages)
        embedder = create_vector_store(split_docs)

    context = retrieve_context(query, embedder)
    answer = generate_answer_with_ollama(query, context)
    return answer

if __name__ == "__main__":
    pdf_path = 'Os.pdf'
    # Initial run to ensure vector store is created
    if not os.path.exists(DOCS_FILE):
        print("Initial setup: Processing PDF and creating vector store...")
        main(pdf_path, "initial setup")

    while(True):
        query = input("enter the query ? : ")
        if not query:
            continue
        result = main(pdf_path, query)
        print(f"\nAnswer: {result}")