from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess
import chess.pgn
import chess.engine
from typing import Optional
import os

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class moveRequest (BaseModel):
    fen: str
    pgn: Optional[str] = None
    moveNumber: Optional[str] = None

engine_path = os.getenv("/opt/homebrew/bin/stockfish","stockfish")
engine = chess.engine.SimpleEngine.popen_uci(engine_path)


@app.post("/api/make-move")
async def make_move(request: MoveRequest):
    """Endpoint for the bot to make a move"""
    try:
        board = chess.Board(request.fen)
        
        result = engine.play(board, chess.engine.Limit(time=0.5))
        move = result.move
        

        board.push(move)
        
        return {
            "fen": board.fen(),
            "san_move": board.san(move),
            "uci_move": move.uci(),
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@app.post("/engineRunning")
async def check_health():
    return {"status":"ok", "message":"chessbot is running"}