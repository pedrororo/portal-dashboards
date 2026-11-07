"use client";
import {
  BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const CORES = ["#1f6f5c", "#c2410c", "#2563eb", "#9333ea", "#ca8a04", "#db2777", "#0891b2"];

export function Grafico({
  tipo, colunas, linhas, x, y,
}: {
  tipo: "linha" | "barra";
  colunas: string[];
  linhas: (string | number | null)[][];
  x: number;
  y: number[];
}) {
  const data = {
    labels: linhas.map((l) => String(l[x] ?? "")),
    datasets: y.map((col, i) => ({
      label: colunas[col],
      data: linhas.map((l) => (typeof l[col] === "number" ? (l[col] as number) : null)),
      borderColor: CORES[i % CORES.length],
      backgroundColor: CORES[i % CORES.length],
      borderWidth: 1.5,
      pointRadius: 0,
    })),
  };
  // textos do gráfico na mesma cor do texto da página (claro/escuro)
  if (typeof window !== "undefined") {
    const estilo = getComputedStyle(document.body);
    ChartJS.defaults.color = estilo.getPropertyValue("--muted").trim() || estilo.color;
    ChartJS.defaults.borderColor = estilo.getPropertyValue("--border").trim() || ChartJS.defaults.borderColor;
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    scales: { x: { ticks: { maxTicksLimit: 12 } } },
  };
  return (
    <div className="grafico">
      {tipo === "barra" ? <Bar data={data} options={options} /> : <Line data={data} options={options} />}
    </div>
  );
}
