import { useEffect, useState } from "react";

import { APIError } from "../api";
import {
  useDailyReadinessQuery,
  useUpdateDailyReadinessMutation,
} from "../hooks/queries";
import type { DailyReadinessData, DailyReadinessItem } from "../types";
import {
  readinessProgressText,
  readinessStatusLabel,
  readinessStatusMessage,
} from "../utils/readiness";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { StatusBadge } from "./ui/StatusBadge";

function errorMessage(error: unknown): string {
  if (error instanceof APIError && error.code === "HTTP_ERROR") {
    return "Daily readiness API was not found. Restart the backend on this branch and run the latest migrations.";
  }
  return error instanceof APIError
    ? `${error.code}: ${error.message}`
    : "Could not load today's intraday readiness checklist.";
}

function updateItem(
  items: DailyReadinessItem[],
  itemId: string,
  updates: Partial<DailyReadinessItem>,
): DailyReadinessItem[] {
  return items.map((item) =>
    item.id === itemId ? { ...item, ...updates } : item,
  );
}

interface IntradayReadinessPanelProps {
  onReadinessChange?: (readiness: DailyReadinessData) => void;
}

export function IntradayReadinessPanel({
  onReadinessChange,
}: IntradayReadinessPanelProps) {
  const [items, setItems] = useState<DailyReadinessItem[]>([]);
  const [notes, setNotes] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const readinessQuery = useDailyReadinessQuery();
  const readiness = readinessQuery.data ?? null;
  const updateReadinessMutation = useUpdateDailyReadinessMutation();
  const isLoading = readinessQuery.isLoading;
  const isSaving = updateReadinessMutation.isPending;
  const error = readinessQuery.error
    ? errorMessage(readinessQuery.error)
    : updateReadinessMutation.error
      ? errorMessage(updateReadinessMutation.error)
      : "";

  useEffect(() => {
    if (readinessQuery.data) {
      setItems(readinessQuery.data.items);
      setNotes(readinessQuery.data.notes ?? "");
      onReadinessChange?.(readinessQuery.data);
    }
  }, [onReadinessChange, readinessQuery.data]);

  async function saveReadiness() {
    if (!readiness) return;
    setSuccessMessage("");
    try {
      const result = await updateReadinessMutation.mutateAsync({
        date: readiness.readiness_date,
        payload: {
          items: items.map((item) => ({
            id: item.id,
            completed: item.completed,
            notes: item.notes,
          })),
          notes: notes.trim() || null,
        },
      });
      setItems(result.items);
      setNotes(result.notes ?? "");
      setSuccessMessage("Intraday readiness saved.");
      onReadinessChange?.(result);
    } catch {
      // Mutation error is surfaced through `error`.
    }
  }

  const status = readiness?.status ?? "not_cleared";
  const requiredComplete =
    readiness?.required_complete_count ??
    items.filter((item) => item.required && item.completed).length;
  const requiredTotal =
    readiness?.required_total_count ??
    items.filter((item) => item.required).length;

  return (
    <section
      className={`readiness-panel readiness-${status}`}
      aria-labelledby="intraday-readiness-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Daily gate</p>
          <h3 id="intraday-readiness-title">Today&apos;s Intraday Readiness</h3>
        </div>
        <StatusBadge
          className={`readiness-badge readiness-badge-${status}`}
          variant={status}
        >
          {readinessStatusLabel[status]}
        </StatusBadge>
      </div>

      <p className="readiness-message">{readinessStatusMessage[status]}</p>
      <p className="readiness-progress">
        {readinessProgressText(requiredComplete, requiredTotal)}
      </p>

      {isLoading && <p className="empty-state">Loading readiness checklist...</p>}
      {error && <p className="form-message error-message">{error}</p>}

      {!isLoading && items.length > 0 && (
        <>
          <div className="readiness-list">
            {items.map((item) => (
              <article className="readiness-item" key={item.id}>
                <label className="readiness-check">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(event) =>
                      setItems((current) =>
                        updateItem(current, item.id, {
                          completed: event.target.checked,
                        }),
                      )
                    }
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.required ? "Required" : "Optional"}</small>
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={item.notes}
                  placeholder={item.notes_placeholder || "Notes..."}
                  onChange={(event) =>
                    setItems((current) =>
                      updateItem(current, item.id, { notes: event.target.value }),
                    )
                  }
                />
              </article>
            ))}
          </div>

          <Field className="notes-field readiness-day-notes">
            Day notes
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything that affects today's intraday trading permission..."
            />
          </Field>

          {successMessage && (
            <p className="form-message success-message">{successMessage}</p>
          )}
          <Button
            className="readiness-save"
            variant="primary"
            disabled={isSaving}
            onClick={() => void saveReadiness()}
          >
            {isSaving ? "Saving..." : "Save Readiness"}
          </Button>
        </>
      )}
    </section>
  );
}
