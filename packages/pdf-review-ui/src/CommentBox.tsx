import { useState, useEffect } from 'react';

interface CommentBoxProps {
  comment: string;
  onChange: (comment: string) => void;
  onSave: () => void;
}

export default function CommentBox({ comment, onChange, onSave }: CommentBoxProps) {
  const [draft, setDraft] = useState(comment);

  useEffect(() => {
    setDraft(comment);
  }, [comment]);

  const handleSave = () => {
    onChange(draft);
    onSave();
  };

  return (
    <div className="comment-box">
      <div className="field-label">Kommentar für zweiten Lauf</div>
      <textarea
        className="comment-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Hinweis für die nächste Analyse... z.B. 'Dieser Block sollte als Person klassifiziert werden'"
        rows={4}
      />
      {draft !== comment && (
        <button type="button" className="btn-save" onClick={handleSave}>
          Speichern
        </button>
      )}
      {comment && (
        <div className="saved-comment">
          <span className="comment-badge">💬 Gespeichert</span>: {comment}
        </div>
      )}
    </div>
  );
}
