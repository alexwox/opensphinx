import type { QuestionSpec } from "../../schemas";

export type QuestionDraftValue = string | number | boolean | string[] | undefined;

export interface QuestionRendererProps {
  readonly question: QuestionSpec;
  readonly draft: QuestionDraftValue;
  readonly inputName: string;
  readonly disabled?: boolean;
  readonly onChange: (value: QuestionDraftValue) => void;
}

function toggleSelection(
  current: string[],
  option: string,
  maxSelections?: number
) {
  if (current.includes(option)) {
    return current.filter((entry) => entry !== option);
  }

  if (maxSelections && current.length >= maxSelections) {
    return current;
  }

  return [...current, option];
}

export function QuestionRenderer({
  question,
  draft,
  inputName,
  disabled = false,
  onChange
}: QuestionRendererProps) {
  switch (question.type) {
    case "mcq":
      if (question.allowMultiple) {
        const selected = Array.isArray(draft) ? draft : [];

        return (
          <div className="opensphinx-options">
            {question.options.map((option) => (
              <label className="opensphinx-option" key={option}>
                <input
                  checked={selected.includes(option)}
                  disabled={disabled}
                  onChange={() =>
                    onChange(toggleSelection(selected, option))
                  }
                  type="checkbox"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      }

      return (
        <div className="opensphinx-options">
          {question.options.map((option) => (
            <label className="opensphinx-option" key={option}>
              <input
                checked={draft === option}
                disabled={disabled}
                name={inputName}
                onChange={() => onChange(option)}
                type="radio"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );

    case "free_text":
      return (
        <div className="opensphinx-field">
          <textarea
            className="opensphinx-textarea"
            disabled={disabled}
            maxLength={question.maxLength}
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.placeholder}
            rows={5}
            value={typeof draft === "string" ? draft : ""}
          />
          <p className="opensphinx-hint">
            {(typeof draft === "string" ? draft.length : 0)} / {question.maxLength}
          </p>
        </div>
      );

    case "slider":
      return (
        <div className="opensphinx-field">
          <input
            className="opensphinx-slider"
            disabled={disabled}
            max={question.max}
            min={question.min}
            onChange={(event) => onChange(Number(event.target.value))}
            step={question.step}
            type="range"
            value={typeof draft === "number" ? draft : question.min}
          />
          <div className="opensphinx-slider__meta">
            <span>{question.labels?.min ?? question.min}</span>
            <strong>{typeof draft === "number" ? draft : question.min}</strong>
            <span>{question.labels?.max ?? question.max}</span>
          </div>
        </div>
      );

    case "rating":
      return (
        <div className="opensphinx-options opensphinx-options--rating">
          {Array.from({ length: question.max }, (_, index) => index + 1).map(
            (value) => (
              <button
                className="opensphinx-rating-option"
                disabled={disabled}
                key={value}
                onClick={() => onChange(value)}
                type="button"
              >
                {value}
              </button>
            )
          )}
          {(question.labels?.low || question.labels?.high) && (
            <p className="opensphinx-hint">
              {question.labels?.low ?? "Low"} - {question.labels?.high ?? "High"}
            </p>
          )}
        </div>
      );

    case "yes_no":
      return (
        <div className="opensphinx-options opensphinx-options--binary">
          <button
            className="opensphinx-binary-option"
            disabled={disabled}
            onClick={() => onChange(true)}
            type="button"
          >
            Yes
          </button>
          <button
            className="opensphinx-binary-option"
            disabled={disabled}
            onClick={() => onChange(false)}
            type="button"
          >
            No
          </button>
        </div>
      );

    case "number":
      return (
        <label className="opensphinx-field">
          <input
            className="opensphinx-input"
            disabled={disabled}
            max={question.max}
            min={question.min}
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.unit ? `Value in ${question.unit}` : "Enter a number"}
            type="number"
            value={typeof draft === "string" ? draft : ""}
          />
          {question.unit && <span className="opensphinx-hint">{question.unit}</span>}
        </label>
      );

    case "date":
      return (
        <label className="opensphinx-field">
          <input
            className="opensphinx-input"
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            type="date"
            value={typeof draft === "string" ? draft : ""}
          />
        </label>
      );

    case "multi_select": {
      const selected = Array.isArray(draft) ? draft : [];

      return (
        <div className="opensphinx-options">
          {question.options.map((option) => {
            const checked = selected.includes(option);
            const maxReached =
              question.maxSelections !== undefined &&
              selected.length >= question.maxSelections;

            return (
              <label className="opensphinx-option" key={option}>
                <input
                  checked={checked}
                  disabled={disabled || (!checked && maxReached)}
                  onChange={() =>
                    onChange(
                      toggleSelection(selected, option, question.maxSelections)
                    )
                  }
                  type="checkbox"
                />
                <span>{option}</span>
              </label>
            );
          })}
          {question.maxSelections && (
            <p className="opensphinx-hint">
              Select up to {question.maxSelections}.
            </p>
          )}
        </div>
      );
    }

    default: {
      const exhaustiveCheck: never = question;
      return exhaustiveCheck;
    }
  }
}
