import { DSA_BLOCK_TYPES, DSA_BLOCK_LABELS, DSA_BLOCK_COLORS, type DsaBlockType } from './dsaTypes';

interface ClassificationBoxProps {
  blockType: DsaBlockType;
  onChange: (type: DsaBlockType) => void;
  /** Vom LLM vorgeschlagener Typ, optional */
  suggestedType?: DsaBlockType | null;
  onAcceptSuggestion?: () => void;
}

export default function ClassificationBox({ blockType, onChange, suggestedType, onAcceptSuggestion }: ClassificationBoxProps) {
  return (
    <div className="classification-box">
      <label className="field-label">Block-Typ</label>
      <div className="type-grid">
        {DSA_BLOCK_TYPES.map((type) => (
          <button
            key={type}
            className={`type-btn ${blockType === type ? 'active' : ''}`}
            onClick={() => onChange(type)}
            style={{ '--type-color': DSA_BLOCK_COLORS[type] } as React.CSSProperties}
          >
            <span className="type-swatch" style={{ backgroundColor: DSA_BLOCK_COLORS[type] }} />
            {DSA_BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
      {suggestedType && suggestedType !== blockType && (
        <div className="suggestion-banner">
          <span>💡 KI-Vorschlag: {DSA_BLOCK_LABELS[suggestedType]}</span>
          <button className="suggestion-btn" onClick={onAcceptSuggestion}>Übernehmen</button>
        </div>
      )}
    </div>
  );
}
