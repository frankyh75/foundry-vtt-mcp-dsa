import { useState, useEffect } from 'react';

interface TextEditBoxProps {
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function TextEditBox({ text, onChange, onSave, onCancel }: TextEditBoxProps) {
  const [value, setValue] = useState(text);

  useEffect(() => {
    setValue(text);
  }, [text]);

  return (
    <div className="text-edit-box">
      <label className="field-label">Text korrigieren</label>
      <textarea
        className="text-area"
        rows={8}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            onChange(value);
            onSave();
          }
          if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      <div className="text-edit-actions">
        <button className="btn-primary" onClick={() => { onChange(value); onSave(); }}>Speichern (Ctrl+Enter)</button>
        <button className="btn-secondary" onClick={onCancel}>Abbrechen (Esc)</button>
      </div>
    </div>
  );
}
