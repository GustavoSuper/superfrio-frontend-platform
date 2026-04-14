import React, { useState, useEffect } from 'react';
import api from "../../services/api";
import Header from "../../Header";
import SideMenu from "../../SideMenu";
import DataTable from 'react-data-table-component';
import './Groups.css'

function GrupoEdit({ history }) {

const url_string = window.location.href;
const param = url_string.split("/");

const [grupoItens, setGrupoItens] = useState(undefined)
const [loading, setLoading] = useState(false)
const [selectedRows, setSelectedRows] = useState()

async function loadGroupData() {
  const response = await api.get(`/grupo/${param[4]}`);
  setGrupoItens(response.data);
}

useEffect(() => {
  loadGroupData()
},[])

const columns = [
  {
    name: 'Ordem',
    selector: 'ordemitem',
    sortable: true
  },
  {
    name: 'Nome',
    selector: 'nomeitem',
    sortable: true
  },
  {
    name: 'Tipo',
    selector: 'type',
    sortable: true
  },
];

function addItemRack(){
  history.push('/additemrack');
}

async function removeItemRack(){
  setLoading(true)
  if(!selectedRows || selectedRows.length == 0){
    return alert("Nenhum item selecionado")
  }

  const itensIDS = []
  selectedRows.map((item) => {
      itensIDS.push(item._id)
  })

  const requestData = {
      itemsToRemove: itensIDS
  }

    const query = `/grupo/removerItens/${param[4]}`;
    const response = await api.put(query, requestData);
    const data = await response.data;
    loadGroupData()
    setLoading(false)
}

async function DeleteGroup() {
  const text = `Deseja mesmo deletar o grupo ${grupoItens.nome} ?`
  if(window.confirm(text) === true){
    setLoading(true)
    const response = await api.delete(`/grupos/${param[4]}`);
    setLoading(false)
    history.push('/grupos');
  }
}

function handleChange(state){
  setSelectedRows(state.selectedRows)
}
  
return (
  <div style={{minHeight: '100vh', backgroundColor: '#ecf0f5'}}>
    <Header />
    <SideMenu />
    <div className="content-wrapper">
      <section className="content-header">
        <h1>
            {grupoItens ? grupoItens.nome : ""}
        </h1>
        <div>
          <button class="btn btn-success btn-flat margin" onClick={addItemRack}>Adicionar Item</button>
          <button class="btn btn-danger btn-flat margin" style={{backgroundColor: "darkred"}} onClick={removeItemRack}>Remover itens selecionados</button>
          <button class="btn btn-danger btn-flat margin" onClick={DeleteGroup}>Deletar Grupo</button>
        </div>
      </section>
      <section className="content">
      {grupoItens && grupoItens.itensDoGrupo.length > 0 ? (
                <DataTable
                columns={columns}
                data={grupoItens ? grupoItens.itensDoGrupo : ""}
                // onRowClicked={goToGroupPage}
                pointerOnHover
                highlightOnHover
                selectableRows // add checkbox selection
                Clicked
                onSelectedRowsChange={handleChange}
                noDataComponent={''}
            />
      ) : grupoItens == undefined ? <p></p> : (
        <div style={{backgroundColor: 'white', width: '100%'}}>
          <p style={{textAlign: 'center', padding: '2em 0'}}>Grupo Vazio</p>
        </div>
      )}
      </section> 
    </div>
  </div>
);
}

export default GrupoEdit;