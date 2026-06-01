import React, { useState, useEffect, useRef } from "react";
import carregando from "../../assets/loading.gif";
import api from "../../services/api";
import Header from "../../Header";
import SideMenu from "../../SideMenu";
import Footer from "../../Footer";
import DatePicker from "react-datepicker";
import br from "date-fns/locale/pt-BR";
import "react-datepicker/dist/react-datepicker.css";

export default function Edit_ChecklistComp({ history }) {
  const [numero, setNumero] = useState("");
  const [dataentrada, setDataentrada] = useState("");
  const [status, setStatus] = useState("");
  const [nomerequester, setNomerequester] = useState("");
  const [pdf, setPDF] = useState("");
  const [loading, setLoading] = useState("");
  const [nomeaprovador, setNomeaprovador] = useState([]);
  const [editable, setEditable] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [obsgeral, setObsgeral] = useState("");
  const [itens, setItens] = useState([]);
  const [valor, setValor] = useState(0);
  const [valorDevido, setValorDevido] = useState(0);
  const [canReviewItens, setCanReviewItens] = useState(false);

  const [pdfButtonLocked, setPdfButtonLocked] = useState(false);
  const pdfButtonLockTimeoutRef = useRef(null);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalMessage, setPdfModalMessage] = useState("");
  const [pdfModalReloadOnClose, setPdfModalReloadOnClose] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfButtonLockTimeoutRef.current) {
        clearTimeout(pdfButtonLockTimeoutRef.current);
      }
    };
  }, []);

  function openPdfModal(message, reloadOnClose) {
    setPdfModalMessage(message);
    setPdfModalReloadOnClose(!!reloadOnClose);
    setPdfModalOpen(true);
  }

  function closePdfModal() {
    setPdfModalOpen(false);
    if (pdfModalReloadOnClose) {
      setPdfModalReloadOnClose(false);
      history.go(0);
    }
  }

  const url_string = window.location.href;
  const param = url_string.split("/");

  async function loadCompItens() {
    const query = "/despesaItem/despesa/" + param[4];
    const response = await api.get(query);
    const data = await response.data;
    setItens(data);
    let valorCalc = 0;
    let valorDevidoCalc = 0;
    data.forEach((item) => {
      if (String(item.status) !== "3") {
        valorCalc = valorCalc + item.valor;
      } else {
        valorDevidoCalc = valorDevidoCalc + item.valor;
      }
    });
    setValor(valorCalc);
    setValorDevido(valorDevidoCalc);
  }

  async function checkApprOrAdmin() {
    const userid = localStorage.getItem("sfuserid");
    if (!userid) {
      return;
    }
    const response = await api.get("/usuarios/" + userid);
    const data = await response.data;
    const isAdmin = !!data?.[0]?.admin;
    const isAppr = !!data?.[0]?.web_appr;
    if (isAdmin || isAppr) {
      setCanReviewItens(true);
    }
    if (isAdmin) {
      setAdmin(true);
    }
  }

  async function rejectItem(itemId, currentComment) {
    const response = prompt("Motivo da recusa do item:", currentComment || "");
    if (response === null) {
      return;
    }
    setLoading(true);
    await api.put("/despesaItem/" + itemId, {
      status: "3",
      commaprovadorItem: response,
    });
    await loadCompItens();
    setLoading(false);
  }

  async function approveItem(itemId) {
    setLoading(true);
    await api.put("/despesaItem/" + itemId, {
      status: "2",
      commaprovadorItem: "",
    });
    await loadCompItens();
    setLoading(false);
  }

  function renderItemStatus(item) {
    const s = String(item.status || "1");
    if (s === "2") {
      return <span className="label label-success">Aprovado</span>;
    }
    if (s === "3") {
      return <span className="label label-danger">Reprovado</span>;
    }
    return <span className="label label-warning">Pendente</span>;
  }

  async function generatePDF() {
    if (pdfButtonLocked) {
      return;
    }

    setPdfButtonLocked(true);
    if (pdfButtonLockTimeoutRef.current) {
      clearTimeout(pdfButtonLockTimeoutRef.current);
    }
    pdfButtonLockTimeoutRef.current = setTimeout(() => {
      setPdfButtonLocked(false);
      pdfButtonLockTimeoutRef.current = null;
    }, 10000);

    setLoading(true);

    await api
      .post("/generatePDFDespesa/" + param[4], {})
      .then((res) => {
        if (res.data.error != undefined) {
          alert(res.data.error);
          setLoading(false);
          return;
        } else {
          openPdfModal("PDF Gerado com sucesso. Clique no Botão Baixar PDF", true);
          setLoading(false);
        }
      })
      .catch((error) => {
        alert(error);
        setLoading(false);
        return;
      });
  }

  async function downloadPDF() {
    setLoading(true);
    window.open(pdf);
    setLoading(false);
  }

  async function loadProd() {
    const response = await api.get("/despesa/" + param[4]);
    const data = await response.data;
    console.log(JSON.stringify(data));
    setNumero(data[0].numero);
    const dateCheck = new Date(data[0].dataentrada);
    const dateCheck2 = new Date(
      dateCheck.getUTCFullYear(),
      dateCheck.getUTCMonth(),
      dateCheck.getUTCDate()
    );
    setDataentrada(dateCheck2);
    setNomerequester(data[0].nomerequester);
    setNomeaprovador(data[0].nomeaprovador);
    setStatus(data[0].status);
    setPDF(data[0].pdflink);
    setObsgeral(data[0].comentarios);
  }

  useEffect(() => {
    setLoading(true);
    checkApprOrAdmin();
    loadCompItens();
    loadProd();
    setTimeout(() => {
      if (document.getElementById("menu_desp_consulta")) {
        document.getElementById("menu_desp_consulta").className = "active";
      }
    }, 50);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <>
      <Header />
      <SideMenu />

      <div className="content-wrapper">
        <section className="content-header">
          <h1>
            {"Relatório de Despesas"}
            <small>&nbsp;( {"Consulta"} )</small>
          </h1>
        </section>

        <section className="content">
          <div className="row">
            <div className="col-md-12">
              <div className="box-footer">
                <button
                  className="btn btn-default"
                  style={{ marginRight: 8 }}
                  onClick={() => history.goBack()}
                >
                  Voltar
                </button>

                {parseInt(status) > 1 && (
                  <button
                    className="btn btn-info"
                    onClick={() => generatePDF()}
                    style={{ marginRight: 8 }}
                    disabled={loading || pdfButtonLocked}
                  >
                    Gerar PDF
                  </button>
                )}
                {parseInt(status) > 1 && pdf && (
                  <button
                    className="btn btn-info"
                    onClick={() => downloadPDF()}
                    style={{ marginRight: 8 }}
                  >
                    Baixar PDF
                  </button>
                )}
              </div>
              <div className="box box-primary">
                {loading && (
                  <div style={{ alignItems: "center", textAlign: "center" }}>
                    <img src={carregando} width="80"></img>
                  </div>
                )}

                <form
                  id="formCheck"
                  className="form-horizontal"
                >
                  <div className="box-body">
                    <div className="form-group">
                      <label className="col-sm-2" htmlFor="status">
                        Status*
                      </label>
                      <div className="col-sm-4">
                        <select
                          id="status"
                          value={status}
                          className="form-control select2"
                          required
                          disabled={true}
                        >
                          <option key="0" value="0">
                            Pendente
                          </option>
                          <option key="1" value="1">
                            Em Avaliação
                          </option>
                          <option key="2" value="2">
                            Finalizado
                          </option>
                        </select>
                      </div>

                      <label className="col-sm-2 control-label" htmlFor="nome">
                        Número*
                      </label>
                      <div className="col-sm-4">
                        <input
                          id="nome"
                          placeholder="Número da Ordem de Serviço"
                          className="form-control"
                          value={numero}
                          required
                          disabled={true}
                          maxLength={40}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="col-sm-2" htmlFor="nome">
                        Data Entrada*
                      </label>

                      <div className="col-sm-4">
                        <div className="input-group">
                          <div className="input-group-addon">
                            <i className="fa fa-calendar"></i>
                          </div>
                          <DatePicker
                            selected={dataentrada}
                            className="form-control"
                            locale={br}
                            disabled={true}
                            dateFormat="P"
                          />
                        </div>
                      </div>
                      <label className="col-sm-2 control-label" htmlFor="aprovador">
                        Aprovador*
                      </label>
                      <div className="col-sm-4">
                        <input
                          id="aprovador"
                          className="form-control"
                          required
                          disabled={true}
                          maxLength={200}
                          value={nomeaprovador}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="col-sm-2" htmlFor="preco">
                        Requisitante*
                      </label>
                      <div className="col-sm-4">
                        <input
                          id="preco"                         
                          className="form-control"
                          required
                          disabled={true}
                          maxLength={200}
                          value={nomerequester}
                        />
                      </div>
                      <label className="col-sm-2 control-label" htmlFor="valor">
                        Valor*
                      </label>
                      <div className="col-sm-1">
                        <input
                          id="valor"
                          className="form-control"
                          required
                          disabled={true}
                          maxLength={200}
                          value={new Intl.NumberFormat('pt-br',{style: 'currency', currency:'BRL'}).format(valor)}
                          style={{ minWidth: 118, paddingLeft: 6, paddingRight: 6, fontSize: 12 }}
                        />
                      </div>
                      <label className="col-sm-1 control-label" htmlFor="devido">
                        Devido
                      </label>
                      <div className="col-sm-2">
                        <input
                          id="devido"
                          className="form-control"
                          required
                          disabled={true}
                          maxLength={200}
                          value={new Intl.NumberFormat('pt-br',{style: 'currency', currency:'BRL'}).format(valorDevido)}
                          style={{ maxWidth: 118, paddingLeft: 6, paddingRight: 6, fontSize: 12 }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label
                        className="col-sm-2"
                        htmlFor="descr"
                        style={{ paddingTop: 7 }}
                      >
                        Observação Geral*
                      </label>
                      <div className="col-sm-4">
                        <textarea
                          id="obsgeral"
                          className="form-control"
                          rows={3}
                          value={obsgeral}
                          disabled={!editable}
                          onChange={(event) => setObsgeral(event.target.value)}
                        />
                      </div>
                    </div>

                    {/* {pdf && 
                        <div className="form-group">
                        <label
                          className="col-sm-2"
                          htmlFor="idcategoria"
                        >
                          Relatorio PDF
                        </label>
                        <div className="col-sm-10">
                      
                          <a href={pdf}>LINK PARA VISUALIZAR PDF</a>
                      
                        </div>
                        </div>
                      } */}

                    <div className="nav-tabs-custom">
                      <ul className="nav nav-tabs">
                        <li className="active">
                          <a
                            href="#tab_1"
                            data-toggle="tab"
                            aria-expanded="false"
                          >
                            NF's / Recibos
                          </a>
                        </li>
                      </ul>

                      <div className="tab-content">
                        <div className="tab-pane active" id="tab_1">
                          <div className="row">
                            <div className="col-xs-12">
                              <div className="box">
                                {/* /.box-header */}
                                <div className="box-body table-responsive no-padding">
                                  <table className="table table-hover">
                                    <tbody>
                                      <tr>
                                        <th>Tipo Despesa</th>
                                        <th>Descrição</th>
                                        <th>Valor</th>
                                        <th>Link Imagem</th>
                                        <th>Status</th>
                                        {canReviewItens && <th>Ações</th>}
                                      </tr>

                                      {itens &&
                                        itens.map((item) => (
                                          <tr key={item._id}>
                                            <td>{item.categoriaText}</td>
                                            <td>
                                              {item.descr}
                                              {String(item.status) === "3" && item.commaprovadorItem ? (
                                                <div style={{ marginTop: 6 }}>
                                                  <span className="label label-danger">Motivo: {item.commaprovadorItem}</span>
                                                </div>
                                              ) : null}
                                            </td>
                                            <td>{new Intl.NumberFormat('pt-br',{style: 'currency', currency:'BRL'}).format(item.valor)}</td>
                                            <td>
                                              {item.foto ? (
                                                <a
                                                  href={item.foto}
                                                  target="_blank"
                                                >
                                                  <i className="fa fa-image" />
                                                </a>
                                              ) : (
                                                "-"
                                              )}
                                            </td>
                                            <td>{renderItemStatus(item)}</td>
                                            {canReviewItens && (
                                              <td>
                                                {String(item.status) === "3" ? (
                                                  <button
                                                    type="button"
                                                    className="btn btn-xs btn-success"
                                                    onClick={() => approveItem(item._id)}
                                                  >
                                                    Aprovar
                                                  </button>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    className="btn btn-xs btn-danger"
                                                    onClick={() => rejectItem(item._id, item.commaprovadorItem)}
                                                  >
                                                    Recusar
                                                  </button>
                                                )}
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>item
                                </div>
                                {/* /.box-body */}
                              </div>
                              {/* /.box */}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="box-footer">
                    <button
                      className="btn btn-default"
                      style={{ marginRight: 8 }}
                      // onClick={() => history.push("/checklistcomps")}
                      onClick={() => history.goBack()}
                    >
                      Voltar
                    </button>
                  </div>

                  {loading && (
                    <div style={{ alignItems: "center", textAlign: "center" }}>
                      <img src={carregando} width="80"></img>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>



      {pdfModalOpen && <div className="modal-backdrop fade in" />}

      <div
        className={`modal fade${pdfModalOpen ? " in" : ""}`}
        id="modal-pdf-message"
        style={{ display: pdfModalOpen ? "block" : "none" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={() => closePdfModal()}
              >
                <span aria-hidden="true">×</span>
              </button>
              <h4 className="modal-title">PDF</h4>
            </div>
            <div className="modal-body">
              <p>{pdfModalMessage}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => closePdfModal()}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
