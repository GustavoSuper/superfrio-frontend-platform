import React from "react";
import InputMask from "react-input-mask";

export const DADOS_BANCARIOS_VAZIO = {
  tipo: "",
  pix_tipo_chave: "",
  pix_chave: "",
  banco: "",
  tipo_conta: "",
  agencia: "",
  conta: "",
  conta_digito: "",
  titular_nome: "",
  titular_tipo_doc: "",
  titular_documento: ""
};

// Junta os dados vindos da API com os valores padrão (usuários antigos não têm o campo)
export function normalizaDadosBancarios(dados) {
  return { ...DADOS_BANCARIOS_VAZIO, ...(dados || {}) };
}

// Antes de salvar: limpa os campos que não pertencem ao tipo escolhido
export function limpaDadosBancarios(dados) {
  const d = normalizaDadosBancarios(dados);
  if (d.tipo !== "pix" && d.tipo !== "conta") return { ...DADOS_BANCARIOS_VAZIO };
  if (d.tipo === "pix") {
    return { ...d, banco: "", tipo_conta: "", agencia: "", conta: "", conta_digito: "" };
  }
  return { ...d, pix_tipo_chave: "", pix_chave: "" };
}

// Colunas de dados bancários usadas na exportação de despesas (Excel)
export function colunasDadosBancarios(dados) {
  const d = normalizaDadosBancarios(dados);
  const isPix = d.tipo === "pix";
  const isConta = d.tipo === "conta";
  return {
    "Forma de Pagamento": isPix ? "Pix" : isConta ? "Conta bancária" : "",
    "Tipo Chave Pix": isPix ? d.pix_tipo_chave : "",
    "Chave Pix": isPix ? d.pix_chave : "",
    "Banco": isConta ? d.banco : "",
    "Tipo de Conta": isConta ? d.tipo_conta : "",
    "Agência": isConta ? d.agencia : "",
    "Conta": isConta ? (d.conta + (d.conta_digito ? "-" + d.conta_digito : "")) : "",
    "Titular": isPix || isConta ? d.titular_nome : "",
    "Tipo Doc. Titular": isPix || isConta ? d.titular_tipo_doc : "",
    "CPF/CNPJ Titular": isPix || isConta ? d.titular_documento : ""
  };
}

function Campo({ label, children }) {
  return (
    <div className="form-group">
      <label className="col-sm-2">{label}</label>
      <div className="col-sm-4">{children}</div>
    </div>
  );
}

export default function DadosBancarios({ value, onChange }) {
  const dados = normalizaDadosBancarios(value);
  const set = (campo, valor) => onChange({ ...dados, [campo]: valor });

  const temTipo = dados.tipo === "pix" || dados.tipo === "conta";

  return (
    <>
      <h4 style={{ marginTop: 25, marginBottom: 15, borderBottom: "1px solid #eee", paddingBottom: 8 }}>
        Dados Bancários
      </h4>

      <Campo label="Tipo">
        <select
          className="form-control"
          value={dados.tipo}
          onChange={event => set("tipo", event.target.value)}
        >
          <option value="">-- Não informado --</option>
          <option value="pix">Pix</option>
          <option value="conta">Conta bancária</option>
        </select>
      </Campo>

      {dados.tipo === "pix" && (
        <>
          <Campo label="Tipo da chave*">
            <select
              className="form-control"
              required
              value={dados.pix_tipo_chave}
              onChange={event => set("pix_tipo_chave", event.target.value)}
            >
              <option value="" disabled>-- Selecione --</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="E-mail">E-mail</option>
              <option value="Telefone">Telefone</option>
              <option value="Aleatória">Chave aleatória</option>
            </select>
          </Campo>
          <Campo label="Chave Pix*">
            <input
              className="form-control"
              placeholder="Digite a chave Pix"
              required
              maxLength={100}
              value={dados.pix_chave}
              onChange={event => set("pix_chave", event.target.value)}
            />
          </Campo>
        </>
      )}

      {dados.tipo === "conta" && (
        <>
          <Campo label="Banco*">
            <input
              className="form-control"
              placeholder="Nome ou código do banco (ex: 341 - Itaú)"
              required
              maxLength={60}
              value={dados.banco}
              onChange={event => set("banco", event.target.value)}
            />
          </Campo>
          <Campo label="Tipo de conta*">
            <select
              className="form-control"
              required
              value={dados.tipo_conta}
              onChange={event => set("tipo_conta", event.target.value)}
            >
              <option value="" disabled>-- Selecione --</option>
              <option value="Corrente">Conta corrente</option>
              <option value="Poupança">Conta poupança</option>
            </select>
          </Campo>
          <div className="form-group">
            <label className="col-sm-2">Agência / Conta*</label>
            <div className="col-sm-1" style={{ minWidth: 110 }}>
              <input
                className="form-control"
                placeholder="Agência"
                required
                maxLength={10}
                value={dados.agencia}
                onChange={event => set("agencia", event.target.value.replace(/[^0-9-]/g, ""))}
              />
            </div>
            <div className="col-sm-2">
              <input
                className="form-control"
                placeholder="Conta"
                required
                maxLength={20}
                value={dados.conta}
                onChange={event => set("conta", event.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="col-sm-1" style={{ minWidth: 80 }}>
              <input
                className="form-control"
                placeholder="Dígito"
                required
                maxLength={2}
                value={dados.conta_digito}
                onChange={event => set("conta_digito", event.target.value.replace(/[^0-9xX]/g, ""))}
              />
            </div>
          </div>
        </>
      )}

      {temTipo && (
        <>
          <Campo label="Titular*">
            <input
              className="form-control"
              placeholder="Nome completo ou razão social do titular"
              required
              maxLength={100}
              value={dados.titular_nome}
              onChange={event => set("titular_nome", event.target.value)}
            />
          </Campo>
          <Campo label="CPF ou CNPJ*">
            <select
              className="form-control"
              required
              value={dados.titular_tipo_doc}
              onChange={event => onChange({ ...dados, titular_tipo_doc: event.target.value, titular_documento: "" })}
            >
              <option value="" disabled>-- Selecione --</option>
              <option value="CPF">CPF (pessoa física)</option>
              <option value="CNPJ">CNPJ (pessoa jurídica)</option>
            </select>
          </Campo>
          {dados.titular_tipo_doc && (
            <Campo label={dados.titular_tipo_doc + " do titular*"}>
              <InputMask
                className="form-control"
                mask={dados.titular_tipo_doc === "CPF" ? "999.999.999-99" : "99.999.999/9999-99"}
                placeholder={dados.titular_tipo_doc === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                required
                value={dados.titular_documento}
                onChange={event => set("titular_documento", event.target.value)}
              />
            </Campo>
          )}
        </>
      )}
    </>
  );
}
