"use client";
import { useState } from "react";
import { FormAcao } from "@/components/FormAcao";
import { criarDashboard } from "../../actions";

type Dataset = { id: number; nome: string; colunas: string[] };
type Tipo = "interno" | "iframe" | "metabase";

export function NovoDashboardForm({
  clienteId, clienteSlug, datasets, metabase,
}: { clienteId: number; clienteSlug: string; datasets: Dataset[]; metabase: boolean }) {
  const tipoInicial: Tipo = datasets.length ? "interno" : "iframe";
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? 0);
  const colunas = datasets.find((d) => d.id === datasetId)?.colunas ?? [];

  return (
    <FormAcao
      action={criarDashboard}
      botao="Criar dashboard"
      aoConcluir={() => {
        setTipo(tipoInicial);
        setDatasetId(datasets[0]?.id ?? 0);
      }}
    >
      <input type="hidden" name="cliente_id" value={clienteId} />
      <div className="linha">
        <label>Nome<input name="nome" required /></label>
        <label>
          Tipo
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option value="interno" disabled={!datasets.length}>Gráfico do portal (a partir de um dataset)</option>
            <option value="metabase" disabled={!metabase}>Metabase (embed assinado){metabase ? "" : " — não configurado"}</option>
            <option value="iframe">Página externa (iframe)</option>
          </select>
        </label>
      </div>
      <label>Descrição (opcional)<input name="descricao" /></label>

      {tipo === "metabase" ? (
        <>
          <div className="linha">
            <label>Número do dashboard no Metabase<input name="dashboard_metabase" type="number" min={1} required /></label>
            <label>Parâmetro de cliente (opcional)<input name="parametro_cliente" placeholder="ex.: cliente" /></label>
          </div>
          <p className="muted">
            O link é assinado pelo servidor a cada visualização e expira em minutos. Com o parâmetro de cliente,
            o filtro fica travado em “{clienteSlug}”: um mesmo dashboard do Metabase pode servir vários clientes
            sem que um veja os dados do outro. No Metabase, ative o embed do dashboard e marque esse parâmetro como “Locked”.
          </p>
        </>
      ) : tipo === "iframe" ? (
        <>
          <label>URL<input name="url" type="url" placeholder="https://…" required /></label>
          <p className="aviso">
            O portal só controla quem vê o link. Se a URL for pública (ex.: “publicar na web”),
            qualquer pessoa com o link vê o conteúdo. Para dados sensíveis, use o tipo “Gráfico do portal”.
          </p>
        </>
      ) : (
        <>
          <div className="linha">
            <label>
              Dataset
              <select name="dataset_id" value={datasetId} onChange={(e) => setDatasetId(Number(e.target.value))}>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </label>
            <label>
              Gráfico
              <select name="grafico" defaultValue="linha">
                <option value="linha">Linha</option>
                <option value="barra">Barras</option>
              </select>
            </label>
            <label>
              Eixo X
              <select name="x" defaultValue={0} key={datasetId}>
                {colunas.map((c, i) => <option key={i} value={i}>{c}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="checks" key={datasetId}>
            <legend className="muted">Séries (eixo Y)</legend>
            {colunas.map((c, i) => (
              <label key={i}><input type="checkbox" name="y" value={i} defaultChecked={i === 1} /> {c}</label>
            ))}
          </fieldset>
        </>
      )}
    </FormAcao>
  );
}
