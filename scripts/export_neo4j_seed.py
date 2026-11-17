"""
Write database/neo4j_seed.cypher from the in-memory skill graph seed data.

Run from Irish/:  python -m scripts.export_neo4j_seed
"""
from configuration.settings import ROOT_DIR
from backend.graph_rag.independent.skill_graph import to_cypher

if __name__ == "__main__":
    out = ROOT_DIR / "database" / "neo4j_seed.cypher"
    out.write_text(to_cypher(), encoding="utf-8")
    print(f"Wrote {out}")
