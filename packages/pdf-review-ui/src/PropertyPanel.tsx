import ClassificationBox from './ClassificationBox';
import TextEditBox from './TextEditBox';
import { DSA_BLOCK_LABELS, type DsaBlockType, type PdfBBox } from './dsaTypes';

interface PropertyPanelProps {
  boxId: string | null;
  boxType: DsaBlockType;
  boxBbox: PdfBBox | null;
  boxText: string;
  readingOrder?: number;
  suggestedType?: DsaBlockType | null;
  activeTool: string;
  onTypeChange: (type: DsaBlockType) => void;
  onTextChange: (text: string) => void;
  onTextSave?: () => void;
  onTextCancel?: () => void;
  onDelete: () => void;
  onAcceptSuggestion?: () => void;
}

export default function PropertyPanel({
  boxId,
  boxType,
  boxBbox,
  boxText,
  readingOrder,
  suggestedType,
  activeTool,
  onTypeChange,
  onTextChange,
  onTextSave,
  onTextCancel,
  onDelete,
  onAcceptSuggestion,
}: PropertyPanelProps) {
  if (!boxId) {
    return (
      <div className="property-panel empty">
        <p>Kein Block ausgewählt.</p>
        <p className="hint">Wähle einen Block auf der Seite oder zeichne einen neuen.</p>
      </div>
    );
  }

  return (
    <div className="property-panel">
      <div className="panel-header">
        <span className="panel-title">{DSA_BLOCK_LABELS[boxType]}</span>
        <span className="panel-id">{boxId}</span>
      </div>

      <ClassificationBox
        blockType={boxType}
        onChange={onTypeChange}
        suggestedType={suggestedType}
        onAcceptSuggestion={onAcceptSuggestion}
      />

      <div className="field-group">
        <label className="field-label">Position</label>
        {boxBbox && (
          <div className="bbox-display">
            x: {Math.round(boxBbox.x)} · y: {Math.round(boxBbox.y)}
            <br />
            w: {Math.round(boxBbox.w)} · h: {Math.round(boxBbox.h)}
          </div>
        )}
      </div>

      {readingOrder !== undefined && (
        <div className="field-group">
          <label className="field-label">Lesereihenfolge</label>
          <div className="reading-order">#{readingOrder}</div>
        </div>
      )}

      {activeTool === 'edit-text' ? (
        <TextEditBox
          text={boxText}
          onChange={onTextChange}
          onSave={onTextSave ?? (() => {})}
          onCancel={onTextCancel ?? (() => {})}
        />
      ) : (
        <div className="field-group">
          <label className="field-label">Text (Original)</label>
          <div className="text-preview">{boxText || '—'}</div>
        </div>
      )}

      <div className="panel-actions">
        <button className="btn-danger" onClick={onDelete}>Block löschen</button>
      </div>
    </div>
  );
}
