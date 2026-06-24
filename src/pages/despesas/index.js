import React, { useState, useEffect, useMemo } from "react";
import carregando from "../../assets/loading.gif";
import api from "../../services/api";
import Header from "../../Header";
import SideMenu from "../../SideMenu";
import Footer from "../../Footer";
import DataTable from "react-data-table-component";
import './despesas.css'
import "react-data-table-component-extensions/dist/index.css";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const DEFAULT_DESPESAS_COLUMN_ORDER = [
  "numero",
  "nomerequester",
  "requesterArea",
  "dataentrada",
  "approvedAt",
  "status",
  "nomeaprovador",
  "paid",
  "paidAt",
];

const MAX_BULK_DELETE_COUNT = 10;
const MAX_SELECTED_DESPESAS_PDF = 60;

export default function List_Despesas({ history }) {
  const [prod, setProd] = useState([]);
  const [exportExcel, setExportExcel] = useState([]);
  const [loading, setLoading] = useState("");
  const [msgvazio, setMsgvazio] = useState("carregando...");
  const [rowsSel, setRowsSel] = useState([]);
  const [selectedIDS, setselectedIDS] = useState([]);
  const [clearSelectedRows, setClearSelectedRows] = useState(false);
  const [canSetPaid, setCanSetPaid] = useState(false);
  const [paidEditMode, setPaidEditMode] = useState(false);
  const [paidUpdatingIds, setPaidUpdatingIds] = useState({});
  const [selectedPaidDate, setSelectedPaidDate] = useState(getCurrentDate());
  const [showColumnReorder, setShowColumnReorder] = useState(false);
  const [searchTable, setSearchTable] = useState("");
  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem("despesas:columnOrder");
    if (!saved) {
      return DEFAULT_DESPESAS_COLUMN_ORDER;
    }
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        return DEFAULT_DESPESAS_COLUMN_ORDER;
      }
      const valid = parsed.filter((id) => DEFAULT_DESPESAS_COLUMN_ORDER.includes(id));
      const missing = DEFAULT_DESPESAS_COLUMN_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    } catch {
      return DEFAULT_DESPESAS_COLUMN_ORDER;
    }
  });
  

  const url_string = window.location.href;
  const param = url_string.split("=");

  function efetivaBusca() {
    loadDespesas();
  }

  function getStatusLabel(status) {
    if (String(status) === "0") return "Rascunho";
    if (String(status) === "1") return "Aguardando Aprovação";
    if (String(status) === "2") return "Aprovado";
    if (String(status) === "3") return "Reprovado";
    return "Desconhecido";
  }

  function getBulkDeleteConfirmationText(count) {
    return `REMOVER ${count} DESPESAS`;
  }

  function resetSelection() {
    setRowsSel([]);
    setselectedIDS([]);
    setClearSelectedRows((prev) => !prev);
  }

  const CustomStatus = ({ row }) =>
    row.status == "0" ? (
      <span className="label label-info">Rascunho</span>
    ) : row.status == "1" ? (
      <span className="label label-warning">Aguardando Aprovação</span>
    ) : row.status == "2" ? (
      <span className="label label-success">Aprovado</span>
    ) : row.status == "3" ? (
      <span className="label label-danger">Reprovado</span>
    ) : (
      ""
    );

  const CustomValor = ({ row }) => <span>R${row.valor}</span>;

  const CustomPaid = ({ row }) =>
    row.paid ? (
      <span className="label label-success">Pago</span>
    ) : (
      <span className="label label-default">Em aberto</span>
    );

  const formatDateInput = (dateISO) => {
    if (!dateISO) {
      return "";
    }
    const data = new Date(dateISO);
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(data.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  async function togglePaid(row) {
    const rowId = row?._id;
    if (!rowId) {
      return;
    }

    const previousPaid = !!row.paid;
    const nextPaid = !previousPaid;

    setProd((prev) => prev.map((p) => (p._id === rowId ? { ...p, paid: nextPaid } : p)));
    setPaidUpdatingIds((prev) => ({ ...prev, [rowId]: true }));

    try {
      await api.put("/despesa/" + rowId, { paid: nextPaid });
      setProd((prev) =>
        prev.map((p) =>
          p._id === rowId
            ? { ...p, paidAt: nextPaid ? p.paidAt || new Date().toISOString() : null }
            : p
        )
      );
    } catch (err) {
      setProd((prev) => prev.map((p) => (p._id === rowId ? { ...p, paid: previousPaid } : p)));
      alert(err?.response?.data?.error || err?.message || "Erro ao atualizar pagamento");
    } finally {
      setPaidUpdatingIds((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
  }

  async function markSelectedAsPaid() {
    if (!selectedIDS || selectedIDS.length === 0) {
      alert("Nenhum relatório selecionado!");
      return;
    }

    if (!window.confirm("Confirma adicionar os relatórios selecionados como pagos?")) {
      return;
    }

    const paidAt = selectedPaidDate ? `${selectedPaidDate}T00:00:00.000Z` : new Date().toISOString();
    const previousProd = prod;

    setLoading(true);
    setProd((prev) =>
      prev.map((item) =>
        selectedIDS.includes(item._id)
          ? { ...item, paid: true, paidAt }
          : item
      )
    );

    try {
      await api.post("/despesa/mark-paid/selected", {
        selectedItems: selectedIDS,
        paidAt,
      });
      await loadDespesas();
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      setProd(previousProd);
      alert(err?.response?.data?.error || err?.message || "Erro ao adicionar relatórios como pagos");
    } finally {
      setLoading(false);
      setRowsSel([]);
      setselectedIDS([]);
    }
  }

  async function updatePaidAt(row, value) {
    const rowId = row?._id;
    if (!rowId) {
      return;
    }

    const previousPaidAt = row.paidAt || null;
    const nextPaidAt = value ? `${value}T00:00:00.000Z` : null;

    setProd((prev) => prev.map((p) => (p._id === rowId ? { ...p, paidAt: nextPaidAt, paid: !!nextPaidAt } : p)));
    setPaidUpdatingIds((prev) => ({ ...prev, [rowId]: true }));

    try {
      await api.put("/despesa/" + rowId, { paidAt: nextPaidAt });
    } catch (err) {
      setProd((prev) => prev.map((p) => (p._id === rowId ? { ...p, paidAt: previousPaidAt, paid: !!previousPaidAt } : p)));
      alert(err?.response?.data?.error || err?.message || "Erro ao atualizar data de pagamento");
    } finally {
      setPaidUpdatingIds((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
  }

  const CustomDate = ({ row }) =>
    row.dataentrada.substring(8, 10) +
    "/" +
    row.dataentrada.substring(5, 7) +
    "/" +
    row.dataentrada.substring(0, 4);

    function formatDate(dateISO){
      const data = new Date(dateISO);

      // Obtém o dia, mês e ano
      const dia = String(data.getUTCDate()).padStart(2, '0'); // Garante que o dia tenha 2 dígitos
      const mes = String(data.getUTCMonth() + 1).padStart(2, '0'); // Adiciona 1 ao mês e garante que tenha 2 dígitos
      const ano = data.getUTCFullYear();

      // Formata a data como uma string no formato dia/mês/ano
      const dataFormatada = `${dia}/${mes}/${ano}`;
      return dataFormatada
    }

  const CustomFoto = ({ row }) => (
    <a href={row.foto} target="_blank">
      <i className="fa fa-image" />
    </a>
  );

  const TruncatedCell = ({ value }) => (
    <span className="despesas-table-text" title={value || ""}>
      {value || "-"}
    </span>
  );

  const sortDate = (rowA, rowB, field) => {
    const dateA = rowA[field] ? new Date(rowA[field]).getTime() : 0;
    const dateB = rowB[field] ? new Date(rowB[field]).getTime() : 0;
    return dateA - dateB;
  };

  const columnsBase = useMemo(
    () => [
      {
        id: "numero",
        name: "Nº",
        selector: "numero",
        sortable: true,
        width: "112px",
        compact: true,
        center: true,
      },
      {
        id: "nomerequester",
        name: "Requisitante",
        selector: "nomerequester",
        sortable: true,
        grow: 1.1,
        minWidth: "150px",
        maxWidth: "190px",
        cell: (row) => <TruncatedCell value={row.nomerequester ? String(row.nomerequester).toUpperCase() : ""} />,
      },
      {
        id: "requesterArea",
        name: "Área",
        selector: "requesterArea",
        sortable: true,
        grow: 1,
        minWidth: "145px",
        cell: (row) => <TruncatedCell value={row.requesterArea ? String(row.requesterArea).toUpperCase() : "-"} />,
      },
      {
        id: "dataentrada",
        name: "Criado em",
        selector: "dataentrada",
        sortable: true,
        sortFunction: (rowA, rowB) => sortDate(rowA, rowB, "dataentrada"),
        width: "118px",
        compact: true,
        cell: (row) => <CustomDate row={row} />,
      },
      {
        id: "approvedAt",
        name: "Aprovado em",
        selector: "approvedAt",
        sortable: true,
        sortFunction: (rowA, rowB) => sortDate(rowA, rowB, "approvedAt"),
        width: "126px",
        compact: true,
        cell: (row) => (row.approvedAt ? formatDate(row.approvedAt) : "-"),
      },
      {
        id: "status",
        name: "Status",
        selector: "status",
        sortable: true,
        width: "150px",
        compact: true,
        cell: (row) => <CustomStatus row={row} />,
      },
      {
        id: "nomeaprovador",
        name: "Aprovador",
        selector: "nomeaprovador",
        grow: 1.1,
        minWidth: "150px",
        maxWidth: "190px",
        cell: (row) => <TruncatedCell value={row.nomeaprovador ? String(row.nomeaprovador).toUpperCase() : ""} />,
      },
      {
        id: "paid",
        name: "Pago",
        selector: "paid",
        sortable: true,
        width: "74px",
        compact: true,
        center: true,
        cell: (row) =>
          canSetPaid && paidEditMode ? (
            <input
              type="checkbox"
              checked={!!row.paid}
              disabled={!!paidUpdatingIds[row._id]}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                togglePaid(row);
              }}
            />
          ) : (
            <CustomPaid row={row} />
          ),
      },
      {
        id: "paidAt",
        name: "Data Pagamento",
        selector: "paidAt",
        sortable: true,
        sortFunction: (rowA, rowB) => sortDate(rowA, rowB, "paidAt"),
        width: "176px",
        compact: true,
        style: {
          paddingLeft: "14px",
        },
        cell: (row) =>
          canSetPaid && paidEditMode ? (
            <input
              type="date"
              className="form-control"
              value={formatDateInput(row.paidAt)}
              disabled={!!paidUpdatingIds[row._id]}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                updatePaidAt(row, e.target.value);
              }}
              style={{ height: 28, width: 132, padding: "3px 6px", fontSize: 12 }}
            />
          ) : row.paidAt ? (
            formatDate(row.paidAt)
          ) : (
            "-"
          ),
      },
    ],
    [canSetPaid, paidEditMode, paidUpdatingIds]
  );

  const columnsById = useMemo(() => {
    const map = {};
    for (const col of columnsBase) {
      map[col.id] = col;
    }
    return map;
  }, [columnsBase]);

  useEffect(() => {
    localStorage.setItem("despesas:columnOrder", JSON.stringify(columnOrder));
  }, [columnOrder]);


  const columns = useMemo(() => {
    const order = Array.isArray(columnOrder) ? columnOrder : DEFAULT_DESPESAS_COLUMN_ORDER;
    const fixedEndColumns = ["paid", "paidAt"];
    const valid = order.filter((id) => !!columnsById[id] && !fixedEndColumns.includes(id));
    const missing = DEFAULT_DESPESAS_COLUMN_ORDER.filter((id) => !fixedEndColumns.includes(id) && !valid.includes(id) && !!columnsById[id]);
    const finalOrder = [...valid, ...missing, ...fixedEndColumns].filter((id) => !!columnsById[id]);
    return finalOrder.map((id) => columnsById[id]).filter(Boolean);
  }, [columnOrder, columnsById]);

  // const goToPage = (state) => {
  //   history.push('/checklistcomp/' + state._id);
  // };

  const goToPage = (state) => {
    history.push('/despesa/' + state._id);
  };

  async function loadProd() {
    //setLoading(true);
    const query = "/despesaItem/aggreg/export";
    const response = await api.get(query);
    const data = await response.data;
    setExportExcel(data);
    //setLoading(false);
  }
 
  const [searchByName, setSearchByName] = useState(undefined)
  const [startDate, setStartDate] = useState(undefined)
  const [endDate, setendDate] = useState(undefined)

  const [intervalWindow, setIntervalWindow] = useState(false)

  function checkModalClose(e){
    if(e.target.className === "selectInterval"){
      setIntervalWindow(false)
    }
  }

  // filtros locais (client-side)
  const [filterArea, setFilterArea] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAprovador, setFilterAprovador] = useState("");
  const [filterRequisitante, setFilterRequisitante] = useState("");
  const [filterPaid, setFilterPaid] = useState("all");

  // Persistência de filtros entre navegações
  function saveFiltersToSession() {
    try {
      const payload = {
        searchByName,
        startDate,
        endDate,
        filterArea,
        filterStatus,
        filterAprovador,
        filterRequisitante,
        filterPaid,
        searchTable,
      };
      sessionStorage.setItem("despesas:filters", JSON.stringify(payload));
    } catch (err) {
      // não bloquear execução em caso de erro
    }
  }

  function restoreFiltersFromSession() {
    try {
      const raw = sessionStorage.getItem("despesas:filters");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj) return;

      if (obj.searchByName !== undefined) setSearchByName(obj.searchByName);
      if (obj.startDate !== undefined) setStartDate(obj.startDate);
      if (obj.endDate !== undefined) setendDate(obj.endDate);
      if (obj.filterArea !== undefined) setFilterArea(obj.filterArea);
      if (obj.filterStatus !== undefined) setFilterStatus(obj.filterStatus);
      if (obj.filterAprovador !== undefined) setFilterAprovador(obj.filterAprovador);
      if (obj.filterRequisitante !== undefined) setFilterRequisitante(obj.filterRequisitante);
      if (obj.filterPaid !== undefined) setFilterPaid(obj.filterPaid);
      if (obj.searchTable !== undefined) setSearchTable(obj.searchTable);
    } catch (err) {
      // ignore
    }
  }

  async function loadDespesas() {
    setLoading(true);

    var query = "/despesa"
    
    //Filtro apenas por nome
    if(searchByName !== undefined && searchByName !== ""){
      query = `/despesa?name=${searchByName}`;
    }

    //Filtro apenas por intervalo
    if(startDate !== undefined && endDate !== undefined){
      query = `/despesa?startDate=${startDate}&endDate=${endDate}`
    }

    //Filtro por nome e intervalo
    if(searchByName !== undefined && startDate !== undefined && endDate !== undefined){
      query = `/despesa?name=${searchByName}&startDate=${startDate}&endDate=${endDate}`
    }

    // console.log(`${searchByName}, ${startDate}, ${endDate}`)
    // alert(query)

    const response = await api.get(query);
    const data = await response.data;
    setProd(data);
    setLoading(false);
  }

  // Derived lists and filtered data (client-side filtering only)
  const areas = useMemo(() => [...new Set(prod.map((p) => p.requesterArea).filter(Boolean))], [prod]);
  const aprovadores = useMemo(() => [...new Set(prod.map((p) => p.nomeaprovador).filter(Boolean))], [prod]);
  const requisitantes = useMemo(() => [...new Set(prod.map((p) => p.nomerequester).filter(Boolean))], [prod]);

  const filteredProd = useMemo(() => {
    return prod.filter((row) => {
      if (filterArea && String(row.requesterArea || "") !== String(filterArea)) return false;
      if (filterStatus && String(row.status) !== String(filterStatus)) return false;
      if (filterAprovador && String(row.nomeaprovador || "") !== String(filterAprovador)) return false;
      if (filterRequisitante && String(row.nomerequester || "") !== String(filterRequisitante)) return false;
      if (filterPaid === "paid" && !row.paid) return false;
      if (filterPaid === "unpaid" && row.paid) return false;
      
      // Filtro de busca
      if (searchTable) {
        const searchLower = searchTable.toLowerCase();
        const matchFields = [
          row.numero?.toString(),
          row.nomerequester,
          row.requesterArea,
          row.nomeaprovador,
        ].filter(Boolean);
        
        const hasMatch = matchFields.some(field => 
          String(field).toLowerCase().includes(searchLower)
        );
        
        if (!hasMatch) return false;
      }
      
      return true;
    });
  }, [prod, filterArea, filterStatus, filterAprovador, filterRequisitante, filterPaid, searchTable]);

  function submitFilterForm(e){
    e.preventDefault()
    loadDespesas()
  }

  function getCurrentDate(){
    const dataAtual = new Date();
    const ano = dataAtual.getFullYear(); //Obtem o ano
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0'); // Adiciona 1 para obter o mês correto e garante que tenha 2 dígitos
    const dia = String(dataAtual.getDate()).padStart(2, '0'); // Garante que o dia tenha 2 dígitos
    const dataFormatada = `${ano}-${mes}-${dia}`;
    return dataFormatada
  }

  async function intervalFilter(e){
    const value = e.target.value;

    if(value === "Em qualquer data"){
      setendDate(undefined)
      setStartDate(undefined)
    }
    
    if(value === "No último ano"){
      setendDate(getCurrentDate())

      const data = new Date(getCurrentDate())
      data.setFullYear(data.getFullYear() - 1)
      const novaData = data.toISOString().split('T')[0];
      setStartDate(novaData)
    }

    if(value === "Nos últimos 6 meses"){
      setendDate(getCurrentDate())

      const data = new Date(getCurrentDate());
      data.setMonth(data.getMonth() - 6);
      const novaData = data.toISOString().split('T')[0];
      setStartDate(novaData)
    }

    if(value === "Intervalo personalizado"){
      setIntervalWindow(true)
    }
  }

  function submitInterval(e){
    e.preventDefault()
    setIntervalWindow(false)
    loadDespesas()
  }

  async function checkCanSetPaid() {
    const userid = localStorage.getItem("sfuserid");
    if (!userid) {
      return;
    }
    const response = await api.get("/usuarios/" + userid);
    const data = await response.data;
    const isAdmin = !!data?.[0]?.admin;
    const isFinance = !!data?.[0]?.receive_final_despesa;
    if (isAdmin || isFinance) {
      setCanSetPaid(true);
    }
  }

  useEffect(() => {
    setLoading(true);
    checkCanSetPaid();
    // restaurar filtros salvos (se houver) antes de carregar
    restoreFiltersFromSession();
    //loadProd();
    // small timeout to ensure restored states propagate before load
    setTimeout(() => {
      loadDespesas();
    }, 50);
    setMsgvazio("Nenhuma despesa encontrada");
    setTimeout(() => {
      if (document.getElementById("menu_desp_consulta")) {
        document.getElementById("menu_desp_consulta").className = "active";
      }
    }, 50);
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }, []);

  // Salva filtros sempre que mudarem
  useEffect(() => {
    saveFiltersToSession();
  }, [searchByName, startDate, endDate, filterArea, filterStatus, filterAprovador, filterRequisitante, filterPaid, searchTable]);

  async function handleRemove() {
    if (!rowsSel || rowsSel.length === 0) {
      alert("Nenhum registro selecionado !");
      return;
    }

    if (rowsSel.length > MAX_BULK_DELETE_COUNT) {
      alert(`Por segurança, é permitido remover no máximo ${MAX_BULK_DELETE_COUNT} despesas por vez.`);
      return;
    }

    const invalidRows = rowsSel.filter((item) => !["0", "1"].includes(String(item.status)));
    if (invalidRows.length > 0) {
      const invalidList = invalidRows
        .map((item) => `#${item.numero} (${getStatusLabel(item.status)})`)
        .join(", ");
      alert(`Só é permitido remover despesas em Rascunho ou Aguardando Aprovação.\nItens bloqueados: ${invalidList}`);
      return;
    }

    if (!window.confirm("Confirma remoção dos itens selecionados? Essa ação é irreversível.")) {
      return;
    }

    const confirmationText = getBulkDeleteConfirmationText(selectedIDS.length);
    const typedConfirmation = window.prompt(
      `Para confirmar a exclusão de ${selectedIDS.length} despesa(s), digite exatamente:\n${confirmationText}`,
      ""
    );

    if (typedConfirmation === null) {
      return;
    }

    if (String(typedConfirmation).trim().toUpperCase() !== confirmationText) {
      alert("Confirmação inválida. Nenhuma despesa foi removida.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/despesa/delete/selected", {
        selectedItems: selectedIDS,
        expectedCount: selectedIDS.length,
        confirmationText,
      });

      const deletedCount = response?.data?.deletedCount || 0;
      const blockedItems = Array.isArray(response?.data?.blockedItems) ? response.data.blockedItems : [];
      const blockedCount = response?.data?.blockedCount || blockedItems.length;

      await loadDespesas();
      resetSelection();

      alert(`${deletedCount} despesa(s) removida(s) com sucesso.`);
    } catch (error) {
      const blockedItems = Array.isArray(error?.response?.data?.blockedItems) ? error.response.data.blockedItems : [];
      if (blockedItems.length > 0) {
        const blockedList = blockedItems
          .map((item) => `#${item.numero || item.id} (${item.reason})`)
          .join(", ");
        alert(`${error?.response?.data?.error || "Nenhuma despesa foi removida."}\n${blockedList}`);
        return;
      }

      alert(error?.response?.data?.error || error?.message || "Erro ao remover despesas");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (state) => {
    setRowsSel(state.selectedRows);

    const AllItems = [];
    state.selectedRows.forEach((item) => {
      AllItems.push(item._id);
    });
    setselectedIDS(AllItems);
  };

  const moveColumn = (columnId, direction) => {
    const currentIndex = columnOrder.indexOf(columnId);
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex + (direction === 'left' ? -1 : 1);
    
    if (newIndex < 0 || newIndex >= columnOrder.length) return;
    
    const newOrder = [...columnOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setColumnOrder(newOrder);
  };

  const tableData = {
    columns,
    data: filteredProd,
  };

  const reorderableColumns = columns.filter((col) => col.id !== "paid" && col.id !== "paidAt");

  async function exportFotosPdfSelected() {
    if (!selectedIDS || selectedIDS.length === 0) {
      alert("Nenhum relatório selecionado!");
      return;
    }

    if (selectedIDS.length > MAX_SELECTED_DESPESAS_PDF) {
      alert(`Selecione no máximo ${MAX_SELECTED_DESPESAS_PDF} despesas por exportação em PDF.`);
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/generatePDFDespesaFotos/selected", {
        selectedItems: selectedIDS,
      });

      if (response?.data?.pdflink) {
        window.open(response.data.pdflink, "_blank");
        if (response?.data?.skippedCount > 0) {
          alert(`PDF gerado com sucesso. ${response.data.skippedCount} despesa(s) sem foto foram ignoradas.`);
        }
        return;
      }

      alert(response?.data?.error || "Não foi possível gerar o PDF");
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || "Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  }

  const exportToExcel = async () => {
    setLoading(true);
    const query = "/despesaItem/aggreg/export";
    const response = await api.get(query);
    const data = await response.data;
    let arrClone = [];

    for(const index in data){
      if(data[index].iddespesa.length > 0){
        data[index].Numero = data[index].iddespesa[0].numero;
        data[index].Requisitante = data[index].iddespesa[0].nomerequester;
        data[index].Area = data[index].iddespesa[0].requesterArea || data[index].requesterArea || "";
        data[index].Criado = data[index].iddespesa[0].dataentrada;
        data[index].Aprovado = data[index].iddespesa[0].approvedAt ? formatDate(data[index].iddespesa[0].approvedAt) : "";
        data[index].Status = data[index].iddespesa[0].status == "0" ? "Rascunho" 
        : data[index].iddespesa[0].status == "1" ? "Aguardando Aprovação"
        : data[index].iddespesa[0].status == "2" ? "Aprovado"
        : data[index].iddespesa[0].status == "3" ? "Reprovado"
        :"";
        data[index].Aprovador = data[index].iddespesa[0].nomeaprovador;
        data[index].Pago = data[index].iddespesa[0].paid ? "Sim" : "Não";
        data[index].DataPagamento = data[index].iddespesa[0].paidAt ? formatDate(data[index].iddespesa[0].paidAt) : "";
        data[index].Tipo = data[index].categoriaText;
        data[index].Valor = data[index].valor;

        delete data[index].iddespesa;
        delete data[index].categoriaText;
        delete data[index].descr;
        delete data[index].valor;
        delete data[index].foto;
        delete data[index]._id;
        delete data[index].requesterArea;

        arrClone.push(data[index]);
      }
    }

    //console.log(arrClone)
    
    const worksheet = XLSX.utils.json_to_sheet(arrClone);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(blob, "Despesas.xlsx");
    setLoading(false);
};

const exportToExcelSelected = async () => {
  if(selectedIDS.length === 0){
    alert("Nenhum item selecionado")
    return;
  }
  setLoading(true);
  const query = "/despesaItem/aggreg/export/selectedByID";
  const requestBody = {
    selectedItems: selectedIDS
  };
  const response = await api.post(query, requestBody);
  const data = await response.data;
  let arrClone = [];

  if(data){
    data.map((item) => {
      arrClone.push({
        Aprovador: item.iddespesa.nomeaprovador,
        Aprovado: item.iddespesa.approvedAt ? formatDate(item.iddespesa.approvedAt) : "",
        Area: item.iddespesa.requesterArea || item.requesterArea || "",
        Criado: item.iddespesa.createdAt,
        DataPagamento: item.iddespesa.paidAt ? formatDate(item.iddespesa.paidAt) : "",
        Numero: item.iddespesa.numero,
        Pago: item.iddespesa.paid ? "Sim" : "Não",
        Requisitante: item.iddespesa.nomerequester,
        Status: item.iddespesa.status == 0 ? "Rascunho" 
        : item.iddespesa.status == "1" ? "Aguardando Aprovação"
        : item.iddespesa.status == "2" ? "Aprovado"
        : item.iddespesa.status == "3" ? "Reprovado"
        :"",
        Tipo: item.categoriaText,
        Valor: item.valor
      })
    })
  }

  //console.log(arrClone)
  
  const worksheet = XLSX.utils.json_to_sheet(arrClone);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  saveAs(blob, "Despesas.xlsx");
  setLoading(false);
};

  return (
    <>
      <Header />
      <SideMenu />

      <div>
        <div className="content-wrapper">
          <section className="content-header">
            <h1>Despesas</h1>
          </section>

          <section className="content">
            <div className="row">
              <div className="col-xs-12">
                <div className="box box-primary">
                  {loading && (
                    <div style={{ alignItems: "center", textAlign: "center" }}>
                      <img src={carregando} width="80"></img>
                    </div>
                  )}

                  <div className="col-md-12 nopadding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'nowrap' }}>
                    <div className="col-md-6 nopadding" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-flat margin"
                        style={{ whiteSpace: 'nowrap', marginRight: 6, padding: '6px 8px', fontSize: 12 }}
                        onClick={() => {
                          handleRemove();
                        }}
                        disabled={loading}
                      >
                        Remover Selecionados
                      </button>
                      {selectedIDS.length > 0 && (
                        <>
                          <button
                            type="button"
                            className="btn btn-info btn-flat margin"
                            style={{ whiteSpace: 'nowrap', marginRight: 6, padding: '6px 8px', fontSize: 12 }}
                            onClick={() => {
                              exportToExcelSelected();
                            }}
                            disabled={loading}
                          >
                            Exportar Selecionados
                          </button>
                          <button
                            type="button"
                            className="btn btn-info btn-flat margin"
                            style={{ whiteSpace: 'nowrap', marginRight: 6, padding: '6px 8px', fontSize: 12 }}
                            onClick={() => {
                              exportFotosPdfSelected();
                            }}
                            disabled={loading}
                          >
                            Exportar Fotos (PDF)
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="date"
                              className="form-control"
                              value={selectedPaidDate}
                              onChange={(e) => setSelectedPaidDate(e.target.value)}
                              style={{ height: 36, padding: '6px 8px', fontSize: 12 }}
                            />
                            <button
                              type="button"
                              className="btn btn-success btn-flat margin"
                              style={{ whiteSpace: 'nowrap', marginRight: 6, padding: '6px 8px', fontSize: 12 }}
                              onClick={() => {
                                markSelectedAsPaid();
                              }}
                              disabled={loading}
                            >
                              Adicionar como pago
                            </button>
                          </div>
                        </>
                      )}
                      <button
                        style={{ backgroundColor: "#44b678", whiteSpace: 'nowrap', padding: '6px 8px', fontSize: 12 }}
                        type="button"
                        className="btn btn-info btn-flat margin"
                        onClick={() => {
                          exportToExcel();
                        }}
                        disabled={loading}
                      >
                        Exportar Tudo
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {canSetPaid && (
                        <button
                          type="button"
                          className={paidEditMode ? "btn btn-success btn-flat margin" : "btn btn-primary btn-flat margin"}
                          onClick={() => setPaidEditMode((prev) => !prev)}
                          style={{ marginRight: 8 }}
                        >
                          <i className="fa fa-edit" style={{ marginRight: 8 }}></i>
                          {paidEditMode ? "Concluir edição" : "Editar"}
                        </button>
                      )}
                      <button type="button" className="btn btn-info btn-flat margin" onClick={() => setShowColumnReorder(!showColumnReorder)}>
                        <i className="fa fa-table" style={{ marginRight: 6 }}></i>
                        {showColumnReorder ? "Ocultar" : "Mudar"} Tabela
                      </button>
                    </div>
                  </div>

                  <div className="despesasFilter" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'nowrap', background: '#f0fbf6', border: '1px solid #d7efe0', borderRadius: 6, overflowX: 'auto', marginTop: 10 }}>
                      <select className="form-control" style={{ minWidth: 180, height: 36 }} value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
                        <option value="">Área (Todas)</option>
                        {areas.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>

                      <select className="form-control" style={{ minWidth: 180, height: 36 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">Status (Todos)</option>
                        <option value="0">Rascunho</option>
                        <option value="1">Aguardando Aprovação</option>
                        <option value="2">Aprovado</option>
                        <option value="3">Reprovado</option>
                      </select>

                      <select className="form-control" style={{ minWidth: 180, height: 36 }} value={filterAprovador} onChange={(e) => setFilterAprovador(e.target.value)}>
                        <option value="">Aprovador (Todos)</option>
                        {aprovadores.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>

                      <select className="form-control" style={{ minWidth: 180, height: 36 }} value={filterRequisitante} onChange={(e) => setFilterRequisitante(e.target.value)}>
                        <option value="">Requisitante (Todos)</option>
                        {requisitantes.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>

                      <select className="form-control" style={{ width: 140, height: 36 }} value={filterPaid} onChange={(e) => setFilterPaid(e.target.value)}>
                        <option value="all">Pago (Todos)</option>
                        <option value="paid">Sim</option>
                        <option value="unpaid">Não</option>
                      </select>

                      <button type="button" className="btn btn-primary btn-flat margin" onClick={() => { setFilterArea(''); setFilterStatus(''); setFilterAprovador(''); setFilterRequisitante(''); setFilterPaid('all'); }}>
                        Limpar Filtros
                      </button>
                      {/* <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar..."
                        value={searchTable}
                        onChange={(e) => setSearchTable(e.target.value)}
                        style={{ minWidth: 180, height: 36 }}
                      /> */}
                    </div>

                    {showColumnReorder && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      <label style={{ fontWeight: 'bold', fontSize: 12 }}>Reordenar colunas:</label>
                      <span style={{ fontSize: 11, color: '#555', width: '100%' }}>As colunas Pago e Data Pagamento são fixas e não podem ser movidas.</span>
                      {reorderableColumns.map((col, idx) => (
                        <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}>
                          <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{col.name}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-default"
                            onClick={() => moveColumn(col.id, 'left')}
                            disabled={idx === 0}
                            style={{ padding: '2px 6px', fontSize: 10, marginLeft: 4 }}
                            title="Mover para esquerda"
                          >
                            ◄
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-default"
                            onClick={() => moveColumn(col.id, 'right')}
                            disabled={idx === reorderableColumns.length - 1}
                            style={{ padding: '2px 6px', fontSize: 10 }}
                            title="Mover para direita"
                          >
                            ►
                          </button>
                        </div>
                      ))}
                    </div>
                    )}

                  

                  {/* <div className="selectInterval" style={intervalWindow ? {display: "block"} : {display: "none"}} onClick={(e) => {checkModalClose(e)}}>
                        <form className="contentInterval" onSubmit={(e) => (submitInterval(e))}>
                          <div className="closeSelector" onClick={() => (setIntervalWindow(false))}><p>X</p></div>
                          <h3>Intervalo Personalizado</h3>
                          <div className="dateSelector">
                            <p>Data inicial</p>
                            <input type="date" placeholder="Data inicial" required onChange={(e) => {setStartDate(e.target.value)}}></input>
                          </div>
                          <div className="dateSelector">
                            <p>Data Final</p>
                            <input type="date" placeholder="Data inicial" required onChange={(e) => {setendDate(e.target.value)}}></input>
                          </div>
                          <button type="submit" className="intervalBtn">Aplicar</button>
                        </form>
                  </div> */}



                  {/* <DataTableExtensions
                    {...tableData}
                    filterPlaceholder={"Buscar"}
                    exportHeaders={false}
                    print={false}
                  > */}
                    <DataTable
                      columns={columns}
                      data={filteredProd}
                      onRowClicked={goToPage}
                      selectableRows
                      clearSelectedRows={clearSelectedRows}
                      pagination
                      paginationPerPage={50}
                      paginationRowsPerPageOptions={[50, 100, 200]}
                      pointerOnHover
                      highlightOnHover
                      onSelectedRowsChange={handleChange}
                      noDataComponent={""}
                    />
                  {/* </DataTableExtensions> */}
                </div>
              </div>
            </div>
          </section>
          {/* /.content */}
        </div>
      </div>

      <Footer />
    </>
  );
}


//nome,
//descr,
//preco,
//imagem,
//promocao,
//idestabelecimento
