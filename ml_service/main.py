import warnings
warnings.filterwarnings("ignore", message=".*BitGenerator.*")
warnings.filterwarnings("ignore", category=UserWarning)

import os
import re
import torch
import pandas as pd
import joblib
import numpy as np
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import BertTokenizer, BertForSequenceClassification

app = FastAPI(title="IntelliPM - Minimal Risk & Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================== MODEL LOADING ==========================
print("Loading models and data...")
# Default to checking if running from IntelliPM root or ml_service directly
models_path = 'trained_models/' 
if not os.path.exists(models_path):
    if os.path.exists('ml_service/trained_models/'):
        models_path = 'ml_service/trained_models/'
    else:
        # Fallback if the user puts them here
        models_path = '../trained_models/'

global delay_model, overrun_model, scaler, bert_model, bert_tokenizer, feature_columns

try:
    delay_model = joblib.load(f'{models_path}schedule_overrun_model.pkl')
    print("OK: New delay model loaded")

    overrun_model = joblib.load(f'{models_path}budget_model.pkl')
    print("OK: New budget model loaded")

    scaler = joblib.load(f'{models_path}scaler.pkl')
    print("OK: Scaler loaded")

    # Automatic Feature Name Detection (Replaces reliance on features.pkl)
    try:
        delay_features = delay_model.feature_name_
        print(f"OK: Delay model features detected ({len(delay_features)})")
    except:
        delay_features = None

    try:
        overrun_features = overrun_model.feature_name_
        print(f"OK: Overrun model features detected ({len(overrun_features)})")
    except:
        overrun_features = None

    print("OK: All AI models loaded successfully")

except Exception as e:
    print(f"WARN: Error loading AI models: {e}")
    delay_model = None
    overrun_model = None
    scaler = None
    delay_features = None
    overrun_features = None

# BERT Model
try:
    bert_tokenizer = BertTokenizer.from_pretrained(f'{models_path}bert_model')
    bert_model = BertForSequenceClassification.from_pretrained(f'{models_path}bert_model')
    bert_model.eval()
    print("OK: BERT model loaded")
except Exception as e:
    print(f"ERROR: BERT failed to load: {e}")

print("OK: Data & models ready")

# ========================== PROPOSAL PARSER ==========================
class ProposalParser:
    def _extract_budget(self, text: str) -> Optional[float]:
        patterns = [
            r'\$\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:million|m)',
            r'\$\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*k',
            r'\$\s*(\d+(?:,\d+)*)',
        ]
        text_lower = text.lower() if text else ""
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                amount = float(match.group(1).replace(',', ''))
                if 'million' in match.group(0) or 'm' in match.group(0):
                    amount *= 1_000_000
                elif 'k' in match.group(0):
                    amount *= 1_000
                return amount
        return None

    def _extract_timeline(self, text: str) -> Optional[int]:
        patterns = {
            r'(\d+)\s*months?': 30,
            r'(\d+)\s*weeks?': 7,
            r'(\d+)\s*days?': 1
        }
        text_lower = text.lower() if text else ""
        for pattern, mul in patterns.items():
            match = re.search(pattern, text_lower)
            if match:
                return int(match.group(1)) * mul
        return None

    def _extract_team_size(self, text: str) -> Optional[int]:
        patterns = [
            r'(\d+)\s+(?:developers?|engineers?|people|members)',
            r'team\s+(?:of|size)\s+(\d+)'
        ]
        text_lower = text.lower() if text else ""
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                return int(match.group(1))
        return None

    def _calculate_complexity_score(self, text: str) -> float:
        indicators = {
            'high': ['real-time', 'distributed', 'microservices', 'machine learning', 'ai', 'blockchain', 'scalable'],
            'medium': ['authentication', 'payment', 'api', 'integration', 'dashboard'],
            'low': ['simple', 'basic', 'static', 'landing page', 'portfolio']
        }
        scores = {'high': 0, 'medium': 0, 'low': 0}
        lower = text.lower() if text else ""
        for level, words in indicators.items():
            scores[level] = sum(1 for w in words if w in lower)
        total = sum(scores.values()) or 1
        score = (scores['high']*10 + scores['medium']*6 + scores['low']*2) / total
        return round(min(10, max(1, score)), 2)

    def parse(self, proposal_text: str, provided_budget=None, provided_timeline=None, provided_team_size=None) -> Dict:
        text = (proposal_text or "").lower()
        budget = provided_budget or self._extract_budget(text) or 150000
        timeline_days = provided_timeline or self._extract_timeline(text) or 180
        team_size = provided_team_size or self._extract_team_size(text) or 5
        complexity_score = self._calculate_complexity_score(text)
        
        # New Heuristic Extraction for 38-feature support
        has_tight_deadline = 1 if any(w in text for w in ['tight', 'urgent', 'aggressive', 'asap']) else 0
        has_skill_gaps = 1 if any(p in text for p in ['no experience', 'limited', 'never done', 'learning']) else 0
        
        # Guess Project Type
        proj_type = 0 # Default
        if 'ai' in text or 'machine learning' in text: proj_type = 1
        elif 'web' in text or 'app' in text: proj_type = 2
        elif 'mobile' in text: proj_type = 3

        # Guess External Dependencies
        deps_count = len(re.findall(r'(api|integration|third-party|external|provider)', text))
        
        # Team Experience (0=Junior, 1=Mixed, 2=Senior)
        exp_level = 1
        if 'senior' in text or 'expert' in text: exp_level = 2
        elif 'junior' in text or 'graduate' in text: exp_level = 0

        return {
            'budget': budget,
            'timeline_days': timeline_days,
            'team_size': team_size,
            'Complexity_Score': complexity_score,
            'Estimated_Timeline_Months': int(timeline_days / 30),
            'Project_Budget_USD': budget,
            'Team_Size': team_size,
            'has_tight_deadline': has_tight_deadline,
            'has_skill_gaps': has_skill_gaps,
            'Project_Type': proj_type,
            'External_Dependencies_Count': deps_count,
            'Team_Experience_Level': exp_level,
            'Requirement_Stability': 0.8 if 'vague' in text or 'unknown' in text else 0.3,
            'Technology_Familiarity': 0.4 if 'new' in text or 'modern' in text else 0.8,
        }

proposal_parser = ProposalParser()

# ========================== BERT RISK ==========================
def analyze_with_bert(text: str) -> Dict:
    if 'bert_model' not in globals() or bert_model is None:
        return {'predicted_risk': 'medium', 'confidence': 0.5, 'error': 'BERT not loaded'}
        
    text = text or "No description provided"
    inputs = bert_tokenizer(text, return_tensors='pt', max_length=512, padding='max_length', truncation=True)
    with torch.no_grad():
        outputs = bert_model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)[0]
        pred = torch.argmax(probs).item()
    levels = ['low', 'medium', 'high']
    # Adjust indexing safely depending on exact model output size
    try:
        risk = levels[min(pred, 2)]
    except:
        risk = levels[1]
    return {'predicted_risk': risk, 'confidence': float(probs[pred])}

# ========================== PREDICT DELAY & OVERRUN ==========================
def predict_delay_and_overrun(info: Dict) -> Dict:
    if delay_model is None or overrun_model is None or scaler is None:
        print("WARN: ML models not loaded - using heuristics")
        timeline_months = info.get('Estimated_Timeline_Months', 12)
        return {
            'predicted_delay_days': int(timeline_months * 15),
            'predicted_budget_overrun_pct': 15.0,
            '_debug': {'method': 'heuristic_fallback'}
        }

    try:
        # 1. Base inputs from info
        base_features = {
            'Project_Budget_USD': float(info.get('Project_Budget_USD', 100000)),
            'Estimated_Timeline_Months': int(info.get('Estimated_Timeline_Months', 12)),
            'Team_Size': int(info.get('Team_Size', 5)),
            'Complexity_Score': float(info.get('Complexity_Score', 5.0)),
            'has_skill_gaps': int(info.get('has_skill_gaps', 0)),
            'has_tight_deadline': int(info.get('has_tight_deadline', 0)),
            'Project_Type': int(info.get('Project_Type', 0)),
            'External_Dependencies_Count': int(info.get('External_Dependencies_Count', 0)),
            'Team_Experience_Level': int(info.get('Team_Experience_Level', 1)),
        }

        # 2. Heuristics for the remaining 30+ features required by the retrained model
        extended_features = base_features.copy()
        
        # Calculate derived metrics
        comp = base_features['Complexity_Score']
        extended_features['budget_per_person'] = base_features['Project_Budget_USD'] / (base_features['Team_Size'] + 1)
        extended_features['timeline_per_person'] = base_features['Estimated_Timeline_Months'] / (base_features['Team_Size'] + 1)
        
        # Fill missing features with intelligent stubs based on complexity
        integration_comp = comp * 0.8
        extended_features.update({
            'Methodology_Used': 1 if comp > 7 else 0, # Agile (1) for complex, Waterfall (0) for simple
            'Past_Similar_Projects': 5,
            'Requirement_Stability': float(info.get('Requirement_Stability', 0.5)),
            'Team_Turnover_Rate': 0.1,
            'Vendor_Reliability_Score': 0.9,
            'Historical_Risk_Incidents': int(comp / 2),
            'Technology_Familiarity': float(info.get('Technology_Familiarity', 0.7)),
            'Stakeholder_Engagement_Level': 0.8,
            'Schedule_Pressure': 0.8 if base_features['has_tight_deadline'] else 0.3,
            'Budget_Utilization_Rate': 0.85,
            'Market_Volatility': 0.2,
            'Integration_Complexity': integration_comp,
            'Resource_Availability': 0.9,
            'Previous_Delivery_Success_Rate': 0.85,
            'Project_Manager_Experience': 5, # Years
            'Resource_Contention_Level': 0.3,
            'Risk_Management_Maturity': 0.7,
            'Documentation_Quality': 0.8,
            'Current_Phase_Duration_Months': 2,
            'Technology_Familiarity_num': 7,
            'Resource_Contention_Level_num': 3,
            'Documentation_Quality_num': 8,
            'requirements_risk_score': comp * 0.1,
            'technical_risk_index': comp * 0.12,
            'composite_risk_score': comp * 0.15,
            'experience_interaction': base_features['Team_Experience_Level'] * 5,
            'total_complexity': comp + integration_comp,
            'resource_pressure': (base_features['Estimated_Timeline_Months'] / (base_features['Team_Size'] + 1)) * 1.5
        })

        # Create the comprehensive feature set
        # Add a few extra derived ones found in the Budget model requirements
        extended_features.update({
            'cost_complexity_index': (base_features['Project_Budget_USD'] / 1000) * comp,
            'dependency_load': extended_features['External_Dependencies_Count'] * 2,
            'team_pressure': base_features['Team_Size'] / (base_features['Estimated_Timeline_Months'] + 1),
            'log_budget': np.log1p(base_features['Project_Budget_USD'])
        })

        df_full = pd.DataFrame([extended_features])

        # 3. Model-specific prediction (each with its own feature set)
        if delay_model is not None and delay_features is not None:
            X_delay = df_full.reindex(columns=delay_features, fill_value=0)
            raw_delay = float(delay_model.predict(X_delay)[0])
        else:
            raw_delay = 15 # Fallback

        if overrun_model is not None and overrun_features is not None:
            X_overrun = df_full.reindex(columns=overrun_features, fill_value=0)
            raw_overrun = float(overrun_model.predict(X_overrun)[0])
        else:
            raw_overrun = 12 # Fallback

        print(f">>> ML RAW OUTPUT: delay={raw_delay}, overrun={raw_overrun}")

        predicted_delay_days = round(max(0, raw_delay))
        predicted_budget_overrun_pct = round(max(0, raw_overrun), 1)

        print(f"Final AI prediction: {predicted_delay_days} days delay, {predicted_budget_overrun_pct}% overrun")

        return {
            'predicted_delay_days': predicted_delay_days,
            'predicted_budget_overrun_pct': predicted_budget_overrun_pct,
            '_debug': {'ai_used': True}
        }

    except Exception as e:
        print(f"ERROR: AI prediction error: {e}")
        return {
            'predicted_delay_days': 15,
            'predicted_budget_overrun_pct': 12.0,
            '_debug': {'method': 'fallback', 'error': str(e)}
        }

# ========================== MAIN ENDPOINT ==========================
class ProjectProposal(BaseModel):
    proposal_text: str = ""
    budget: float = None
    timeline_days: int = None
    team_size: int = None

@app.post("/api/analyze-proposal")
async def analyze_proposal(proposal: ProjectProposal):
    try:
        extracted = proposal_parser.parse(
            proposal.proposal_text, 
            proposal.budget, 
            proposal.timeline_days, 
            proposal.team_size
        )

        bert_res = analyze_with_bert(proposal.proposal_text)
        predictions = predict_delay_and_overrun(extracted)

        # Revamped risk calculation: Map BERT levels to numeric scores
        bert_level = bert_res.get('predicted_risk', 'medium')
        bert_mapping = {'low': 0.2, 'medium': 0.5, 'high': 0.9}
        bert_score = bert_mapping.get(bert_level, 0.5)
        
        # Add slight variance based on confidence (+/- 0.05)
        bert_score += (bert_res.get('confidence', 0.5) - 0.5) * 0.1
        
        overrun = predictions.get('predicted_budget_overrun_pct', 0)
        final_risk_score = (bert_score * 0.4) + (overrun / 100 * 0.6)
        risk_level = 'HIGH' if final_risk_score > 0.6 else 'MEDIUM' if final_risk_score > 0.35 else 'LOW'

        return {
            "overall_risk_level": risk_level,
            "risk_score": round(final_risk_score * 100, 1),
            "predicted_delay_days": predictions['predicted_delay_days'],
            "predicted_budget_overrun_pct": predictions['predicted_budget_overrun_pct'],
            "bert_risk": bert_res.get('predicted_risk', 'medium'),
            "bert_confidence": float(bert_res.get('confidence', 0.5)),
            "extracted_info": extracted
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
