# ╔══════════════════════════════════════════════════════════════╗
# ║  DharmaAI Stress Detector — Training Script (Google Colab)  ║
# ║  Fine-tunes DistilBERT on Dreaddit stress dataset           ║
# ║  Combined with pre-trained emotion classifier               ║
# ╚══════════════════════════════════════════════════════════════╝
#
# HOW TO USE:
# 1. Open Google Colab: https://colab.research.google.com
# 2. Set Runtime → Change runtime type → GPU (T4)
# 3. Copy this entire file into a Colab cell (or split by "# CELL" markers)
# 4. Run all cells
# 5. At the end, model uploads to HuggingFace Hub
#
# Total time: ~25-30 minutes on free T4 GPU

# ════════════════════════════════════════════════
# CELL 1: Install Dependencies
# ════════════════════════════════════════════════

# !pip install -q transformers datasets torch scikit-learn accelerate huggingface_hub

# ════════════════════════════════════════════════
# CELL 2: Imports
# ════════════════════════════════════════════════

import torch
import numpy as np
from datasets import load_dataset, Dataset, DatasetDict
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix,
)
import json
import os

print(f"🔧 PyTorch version: {torch.__version__}")
print(f"🖥️ GPU available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"   GPU: {torch.cuda.get_device_name(0)}")

# ════════════════════════════════════════════════
# CELL 3: Load & Prepare Dataset
# ════════════════════════════════════════════════

print("📦 Loading Dreaddit stress detection dataset...")

# Dreaddit: Reddit posts labeled as stressed (1) or not stressed (0)
# ~3.5K samples from 5 subreddits (anxiety, PTSD, financial, etc.)
dataset = load_dataset("dreaddit", split="train", trust_remote_code=True)

print(f"✅ Loaded {len(dataset)} samples")
print(f"   Columns: {dataset.column_names}")
print(f"   Label distribution: {dict(zip(*np.unique(dataset['label'], return_counts=True)))}")

# ── Additional mental health data to improve quality ──
# We'll create some extra training samples from mental wellness conversations
extra_stressed = [
    "I can't sleep at night, my mind keeps racing with worries about everything",
    "I feel overwhelmed with work and family responsibilities, I can't handle it",
    "My anxiety is getting worse every day, I don't know what to do anymore",
    "I feel so alone and nobody understands what I'm going through",
    "I keep having panic attacks and it's affecting my daily life",
    "Everything feels hopeless and I can't see any way out of this situation",
    "I'm constantly worried about my finances and it's eating me alive",
    "I feel exhausted all the time but I can't stop thinking about problems",
    "My relationship is falling apart and I don't know how to fix it",
    "I feel like I'm failing at everything, I'm not good enough",
    "I can't focus on anything because my mind is always stressed",
    "I haven't been eating properly because of all the pressure I'm under",
    "I feel trapped in my current situation with no way to escape",
    "My heart races whenever I think about the future",
    "I cry almost every day because of how stressed I am",
    "I feel like the world is closing in on me and I can't breathe",
    "I'm losing interest in things I used to enjoy",
    "I snap at people for no reason because I'm so tense inside",
    "I dread waking up every morning knowing what awaits me",
    "I feel disconnected from everyone around me",
]

extra_not_stressed = [
    "I had a wonderful meditation session today, feeling very peaceful",
    "I'm grateful for the beautiful sunrise I saw this morning",
    "I feel calm and centered after reading some spiritual wisdom",
    "Today was a productive day and I feel accomplished",
    "I enjoyed spending quality time with my family this evening",
    "I feel at peace with where I am in life right now",
    "The breathing exercises really helped me feel relaxed today",
    "I'm looking forward to the weekend, planning to go hiking",
    "I feel blessed to have such supportive friends around me",
    "I completed my goals for the week and feel satisfied",
    "I tried yoga today and it made me feel so much better",
    "I'm feeling optimistic about the future and my plans",
    "I had a great conversation with a friend and feel uplifted",
    "I feel content just sitting quietly and observing nature",
    "I learned something new today and it was exciting",
    "I feel strong and capable of handling whatever comes my way",
    "The music I listened to today really calmed my mind",
    "I'm feeling happy for no particular reason, just grateful",
    "I slept well last night and woke up refreshed",
    "I feel a deep sense of inner peace today",
]

# Create additional dataset
extra_texts = extra_stressed + extra_not_stressed
extra_labels = [1] * len(extra_stressed) + [0] * len(extra_not_stressed)

extra_dataset = Dataset.from_dict({
    "text": extra_texts,
    "label": extra_labels,
})

print(f"\n📝 Created {len(extra_dataset)} extra wellness-focused samples")

# Combine datasets
# Dreaddit uses different column names, let's standardize
def standardize_dreaddit(example):
    return {
        "text": example["text"],
        "label": example["label"],
    }

dreaddit_clean = dataset.map(standardize_dreaddit, remove_columns=dataset.column_names)

from datasets import concatenate_datasets
combined = concatenate_datasets([dreaddit_clean, extra_dataset])
combined = combined.shuffle(seed=42)

print(f"✅ Combined dataset: {len(combined)} samples")

# Split: 80% train, 10% validation, 10% test
split1 = combined.train_test_split(test_size=0.2, seed=42)
split2 = split1["test"].train_test_split(test_size=0.5, seed=42)

final_dataset = DatasetDict({
    "train": split1["train"],
    "validation": split2["train"],
    "test": split2["test"],
})

print(f"   Train: {len(final_dataset['train'])}")
print(f"   Validation: {len(final_dataset['validation'])}")
print(f"   Test: {len(final_dataset['test'])}")

# ════════════════════════════════════════════════
# CELL 4: Load Model & Tokenizer
# ════════════════════════════════════════════════

MODEL_NAME = "distilbert-base-uncased"

print(f"\n🤖 Loading {MODEL_NAME}...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=2,
    id2label={0: "not_stressed", 1: "stressed"},
    label2id={"not_stressed": 0, "stressed": 1},
)

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"✅ Model loaded: {total_params:,} params ({trainable_params:,} trainable)")

# ════════════════════════════════════════════════
# CELL 5: Tokenize Dataset
# ════════════════════════════════════════════════

def tokenize_function(examples):
    return tokenizer(
        examples["text"],
        padding="max_length",
        truncation=True,
        max_length=256,
    )

print("🔤 Tokenizing dataset...")
tokenized_dataset = final_dataset.map(tokenize_function, batched=True, batch_size=64)

# Set format for PyTorch
tokenized_dataset.set_format("torch", columns=["input_ids", "attention_mask", "label"])
print("✅ Tokenization complete!")

# ════════════════════════════════════════════════
# CELL 6: Training Configuration
# ════════════════════════════════════════════════

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_score(labels, predictions),
        "f1": f1_score(labels, predictions, average="weighted"),
        "precision": precision_score(labels, predictions, average="weighted"),
        "recall": recall_score(labels, predictions, average="weighted"),
    }

training_args = TrainingArguments(
    output_dir="./dharmaai-stress-detector",
    
    # Training
    num_train_epochs=5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=32,
    learning_rate=2e-5,
    weight_decay=0.01,
    warmup_ratio=0.1,
    
    # Evaluation & Saving
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1",
    greater_is_better=True,
    save_total_limit=2,
    
    # Logging
    logging_dir="./logs",
    logging_steps=25,
    report_to="none",
    
    # Performance
    fp16=torch.cuda.is_available(),
    dataloader_num_workers=2,
    
    # Misc
    seed=42,
    push_to_hub=False,  # We'll push manually
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset["train"],
    eval_dataset=tokenized_dataset["validation"],
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
)

# ════════════════════════════════════════════════
# CELL 7: TRAIN! 🚀
# ════════════════════════════════════════════════

print("🚀 Starting training...\n")
print("=" * 50)

train_result = trainer.train()

print("\n" + "=" * 50)
print(f"✅ Training complete!")
print(f"   Total steps: {train_result.global_step}")
print(f"   Training loss: {train_result.training_loss:.4f}")

# ════════════════════════════════════════════════
# CELL 8: Evaluate on Test Set
# ════════════════════════════════════════════════

print("\n📊 Evaluating on test set...\n")

eval_results = trainer.evaluate(tokenized_dataset["test"])

print("=" * 40)
print(f"  Accuracy:  {eval_results['eval_accuracy']:.4f}")
print(f"  F1 Score:  {eval_results['eval_f1']:.4f}")
print(f"  Precision: {eval_results['eval_precision']:.4f}")
print(f"  Recall:    {eval_results['eval_recall']:.4f}")
print("=" * 40)

# Detailed classification report
predictions = trainer.predict(tokenized_dataset["test"])
preds = np.argmax(predictions.predictions, axis=-1)
labels = predictions.label_ids

print("\nDetailed Classification Report:")
print(classification_report(
    labels, preds,
    target_names=["Not Stressed", "Stressed"]
))

print("\nConfusion Matrix:")
cm = confusion_matrix(labels, preds)
print(f"  TN={cm[0][0]}  FP={cm[0][1]}")
print(f"  FN={cm[1][0]}  TP={cm[1][1]}")

# ════════════════════════════════════════════════
# CELL 9: Test with Sample Inputs
# ════════════════════════════════════════════════

print("\n🧪 Testing with sample inputs...\n")

test_sentences = [
    "I feel so overwhelmed with everything going on in my life right now",
    "Today was a peaceful day, I meditated and felt at ease",
    "I can't stop worrying about my exams, I haven't slept in days",
    "I'm grateful for the little things in life, feeling blessed",
    "My anxiety is killing me, I feel like I'm going to have a breakdown",
    "I spent time in nature today and feel completely refreshed",
    "I don't know how to cope with all this pressure at work",
    "How can I find inner peace?",
    "I feel like nobody cares about me",
    "I had a great yoga session, my mind feels clear",
]

# Use the trained model as a pipeline
from transformers import pipeline
stress_pipe = pipeline(
    "text-classification",
    model=trainer.model,
    tokenizer=tokenizer,
    device=0 if torch.cuda.is_available() else -1,
)

for text in test_sentences:
    result = stress_pipe(text)[0]
    label = result["label"]
    score = result["score"]
    emoji = "🔴" if label == "stressed" else "🟢"
    print(f"{emoji} [{label:>13}] ({score:.3f}) → \"{text[:60]}...\"" if len(text) > 60 else f"{emoji} [{label:>13}] ({score:.3f}) → \"{text}\"")

# ════════════════════════════════════════════════
# CELL 10: Save Model Locally
# ════════════════════════════════════════════════

SAVE_DIR = "./dharmaai-stress-model-final"

print(f"\n💾 Saving model to {SAVE_DIR}...")
trainer.model.save_pretrained(SAVE_DIR)
tokenizer.save_pretrained(SAVE_DIR)

# Save training info
info = {
    "model_name": "dharmaai-stress-detector",
    "base_model": MODEL_NAME,
    "dataset": "dreaddit + custom wellness data",
    "num_labels": 2,
    "labels": {"0": "not_stressed", "1": "stressed"},
    "eval_accuracy": eval_results["eval_accuracy"],
    "eval_f1": eval_results["eval_f1"],
    "training_samples": len(final_dataset["train"]),
    "test_samples": len(final_dataset["test"]),
}

with open(f"{SAVE_DIR}/training_info.json", "w") as f:
    json.dump(info, f, indent=2)

print("✅ Model saved!")

# ════════════════════════════════════════════════
# CELL 11: Upload to HuggingFace Hub
# ════════════════════════════════════════════════

# Uncomment and run these lines to upload:

# from huggingface_hub import login
# login()  # This will ask for your HF token
#
# HF_REPO = "YOUR_USERNAME/dharmaai-stress-detector"  # ← CHANGE THIS
#
# print(f"📤 Uploading to {HF_REPO}...")
# trainer.model.push_to_hub(HF_REPO)
# tokenizer.push_to_hub(HF_REPO)
# print(f"✅ Model uploaded to https://huggingface.co/{HF_REPO}")

print("\n" + "=" * 60)
print("🎉 DONE! Your stress detection model is ready.")
print("=" * 60)
print("\nNext steps:")
print("1. Upload to HuggingFace Hub (uncomment Cell 11)")
print("2. Deploy the API on HuggingFace Spaces")
print("3. Connect to your DharmaAI app")
