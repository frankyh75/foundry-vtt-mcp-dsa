import { DSA_BLOCK_TYPES, DSA_BLOCK_LABELS, type DsaBlockType } from './dsaTypes';

interface ClassificationBoxProps {
  blockType: DsaBlockType;
  onChange: (type: DsaBlockType) => void;
  suggestedType?: DsaBlockType | null;
  onAcceptSuggestion?: () => void;
}

export default function ClassificationBox({ blockType, onChange, suggestedType, onAcceptSuggestion }: ClassificationBoxProps) {
  return (
    <div className="classification-box">
      <div className="field-label">Block-Typ</div>
      <div className="type-grid">
        {DSA_BLOCK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`type-chip ${blockType === type ? 'active' : ''} ${suggestedType === type && blockType !== type ? 'suggested' : ''}`}
            onClick={() => onChange(type)}
            title={DSA_BLOCK_LABELS[type]}
          >
            <span className={`type-dot type-${type.replace(/[^a-z0-9]/gi, '-')}`} />
            <span className="type-name">{DSA_BLOCK_LABELS[type]}</span>
          </button>
        ))}
      </div>
      {suggestedType && suggestedType !== blockType && onAcceptSuggestion ? (
        <button type="button" className="suggestion-btn" onClick={onAcceptSuggestion}>
          Vorschlag übernehmen: {DSA_BLOCK_LABELS[suggestedType]}
        </button>
      ) : null}
    </div>
  );
}
