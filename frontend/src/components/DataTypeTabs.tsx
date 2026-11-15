import type { SarDataset } from "../data/sar";

const labels = { water: "Water", forest: "Forest", subsidence: "Subsidence" };
export default function DataTypeTabs({
  datasets,
  dataset,
  onSelect,
}: {
  datasets: SarDataset[];
  dataset: SarDataset;
  onSelect: (id: string) => void;
}) {
  const types = datasets.filter(
    (d, i) => datasets.findIndex((other) => other.kind === d.kind) === i,
  );
  return (
    <div className="data-type-picker">
      {types.length > 1 && (
        <div
          role="tablist"
          aria-label="SAR data type"
          className="data-type-tabs"
        >
          {types.map((d, i) => (
            <button
              key={d.kind}
              role="tab"
              aria-selected={dataset.kind === d.kind}
              tabIndex={dataset.kind === d.kind ? 0 : -1}
              data-kind={d.kind}
              onClick={() => onSelect(d.id)}
              onKeyDown={(event) => {
                const index =
                  event.key === "ArrowRight"
                    ? (i + 1) % types.length
                    : event.key === "ArrowLeft"
                      ? (i + types.length - 1) % types.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? types.length - 1
                          : -1;
                if (index < 0) return;
                event.preventDefault();
                onSelect(types[index].id);
                (
                  event.currentTarget.parentElement?.querySelectorAll("button")[
                    index
                  ] as HTMLButtonElement
                )?.focus();
              }}
            >
              <span className="data-type-dot" />
              {labels[d.kind]}
            </button>
          ))}
        </div>
      )}
      <p className="data-type-title">
        <span className="data-type-dot" />
        {labels[dataset.kind]} · {dataset.name}
      </p>
    </div>
  );
}
