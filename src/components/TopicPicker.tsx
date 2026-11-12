"use client";
import { useEffect, useId, useRef, useState } from "react";
import { normalizeTopicName } from "@/lib/topic-name";
import { Icon } from "./Icon";

/** Small public suggestion projection; only labels are submitted and resolved on the server. */
interface TopicSuggestion {
  /** Existing topic identity used as the list key. */
  id: number;
  /** Preserved display spelling. */
  name: string;
}

/** Editable combobox with literal substring search, race-safe requests, keyboard selection,
 * and a new-topic option. Typing alone never writes to the database.
 */
export function TopicPicker({
  initialName = "",
}: {
  /** Preselected topic from its discovery page. */
  initialName?: string;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialName);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{
    /** Query associated with these results. */ query: string;
    /** Matching public labels. */ items: TopicSuggestion[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const query = normalizeTopicName(value);
  const items = result?.query === query ? result.items : [];
  const loading = open && result?.query !== query && !failed;
  const exact = items.some(
    /** Match the database's case/accent-insensitive identity for the new-label affordance. */ (
      item,
    ) =>
      item.name.localeCompare(query, undefined, { sensitivity: "base" }) === 0,
  );
  const choices = [
    ...items.map(
      /** Existing labels keep their canonical spelling. */ (item) => item.name,
    ),
    ...(!exact && query && !loading ? [query] : []),
  ];

  useEffect(
    /** Debounce network work and discard aborted or stale results after every input change. */ () => {
      if (!open) return;
      const controller = new AbortController();
      setFailed(false);
      const timer = setTimeout(
        /** Fetch only bounded public topic metadata. */ async () => {
          try {
            const response = await fetch(
              `/api/topics?q=${encodeURIComponent(query)}`,
              { signal: controller.signal },
            );
            if (!response.ok) throw new Error("Search unavailable");
            const data: TopicSuggestion[] = await response.json();
            if (!controller.signal.aborted) setResult({ query, items: data });
          } catch {
            if (!controller.signal.aborted) setFailed(true);
          }
        },
        120,
      );
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    },
    [query, open],
  );
  useEffect(
    /** Mirror native form resets without leaving a stale selected topic. */ () => {
      const form = input.current?.form;
      /** Restore the route's initial choice after a successful reset. */
      function reset() {
        setValue(initialName);
        setOpen(false);
        setActive(-1);
      }
      form?.addEventListener("reset", reset);
      return () => form?.removeEventListener("reset", reset);
    },
    [initialName],
  );
  useEffect(
    /** Keep the active keyboard option visible in a long suggestion panel. */ () => {
      if (active >= 0)
        document
          .getElementById(`${listId}-${active}`)
          ?.scrollIntoView({ block: "nearest" });
    },
    [active, listId],
  );
  /** Commit a label locally; creation happens only when the complete post is submitted. */
  function choose(name: string) {
    setValue(name);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  return (
    <div
      className="topic-picker"
      onBlur={
        /** Close only when focus actually leaves the whole control. */ (
          event,
        ) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }
      }
    >
      <span className="topic-chevron" aria-hidden="true">
        ›
      </span>
      <input
        ref={input}
        name="topic_name"
        role="combobox"
        aria-label="Topic"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={100}
        placeholder="Add a topic"
        value={value}
        onFocus={
          /** Reopen suggestions when editing the label. */ () => setOpen(true)
        }
        onChange={
          /** Clear keyboard selection when the typed substring changes. */ (
            event,
          ) => {
            setValue(event.target.value);
            setOpen(true);
            setActive(-1);
            setFailed(false);
          }
        }
        onKeyDown={
          /** Follow combobox conventions without letting Enter submit the enclosing composer. */ (
            event,
          ) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive(
                /** Wrap through the available options. */ (previous) =>
                  choices.length
                    ? previous === -1
                      ? event.key === "ArrowDown"
                        ? 0
                        : choices.length - 1
                      : (previous +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          choices.length) %
                        choices.length
                    : -1,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (choices[active] || query) choose(choices[active] ?? query);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(-1);
            } else if (event.key === "Tab") setOpen(false);
          }
        }
      />
      {value && (
        <button
          type="button"
          className="topic-clear icon-button"
          aria-label="Clear topic"
          onClick={
            /** Clear a draft's topic and return to the search input. */ () => {
              setValue("");
              setActive(-1);
              input.current?.focus();
              setOpen(true);
            }
          }
        >
          <Icon name="close" />
        </button>
      )}
      {open && (
        <div className="topic-popover">
          <div
            id={listId}
            role="listbox"
            aria-label="Topic suggestions"
            className="topic-options"
          >
            {choices.map(
              /** Existing options and a create option use the same keyboard path. */ (
                name,
                index,
              ) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  id={`${listId}-${index}`}
                  key={`${name}-${index}`}
                  tabIndex={-1}
                  className="topic-option"
                  onPointerDown={
                    /** Keep input focus so pointer selection cannot be swallowed by blur. */ (
                      event,
                    ) => event.preventDefault()
                  }
                  onClick={
                    /** Choose this label without submitting the post. */ () =>
                      choose(name)
                  }
                >
                  <strong>{name}</strong>
                  {index >= items.length && <span>+ Tag new topic</span>}
                </button>
              ),
            )}
          </div>
          {loading && (
            <p className="topic-status" role="status">
              Searching topics…
            </p>
          )}
          {failed && (
            <p className="topic-status" role="status">
              Suggestions unavailable. You can still enter a topic.
            </p>
          )}
          {!loading && !failed && !choices.length && (
            <p className="topic-status">Type to find or create a topic.</p>
          )}
        </div>
      )}
    </div>
  );
}
