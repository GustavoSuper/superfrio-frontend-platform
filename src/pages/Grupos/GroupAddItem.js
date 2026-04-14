import React, { useState, useEffect } from 'react';
import api from "../../services/api";
import Header from "../../Header";
import SideMenu from "../../SideMenu";
import DataTable from 'react-data-table-component';
import './Groups.css'

function GroupAddItem({history}) {

    const [itensrack, setItensrack] = useState()
    const [grupos, setGrupos] = useState()
    const [selectedRows, setSelectedRows] = useState()
    const [selectedGroup, setSelectedGroup] = useState("undefined")

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
        }
    ]

    async function loadItensRack(){
        const query = '/checklistitemdefault/type/rack';
        const response = await api.get(query);
        const data = await response.data;
        setItensrack(data)
    }

    async function loadGrupos() {
        const query = '/grupos';
        const response = await api.get(query);
        const data = await response.data;
        setGrupos(data)
    }

    async function addItemsToGroup(e){

        if(selectedGroup == "undefined"){
            return alert("Selecione o grupo")
        }

        if(!selectedRows || selectedRows.length == 0){
            return alert("Nenhum item selecionado")
        }

        const text = `Adicionar ${selectedRows.length} itens ao grupo ?`
        if(window.confirm(text) === true){
            const itensIDS = []
            selectedRows.map((item) => {
                itensIDS.push(item._id)
            })

            const requestData = {
                newItems: itensIDS
            }
            
            const query = `/grupo/adicionarItens/${selectedGroup}`;
            const response = await api.put(query, requestData);
            const data = await response.data;

            history.push(`/grupo/${selectedGroup}`);
        }
    }

    useEffect(() => {
        loadGrupos()
        loadItensRack()
    },[])

    function handleChange(state){
        setSelectedRows(state.selectedRows)
    }

  return (
    <>
        <Header />
        <SideMenu />
        <div className="content-wrapper">
        <section className="content-header">
            <h1>
                Adicionar itens ao grupo
            </h1>
            <div>
            <select defaultValue="undefined" style={{height: "2.2em", padding: "0 1em"}} onChange={(e) => {setSelectedGroup(e.target.value)}}>
                <option disabled value="undefined">Selecione o grupo</option>
                {grupos ? grupos.map((item) => (
                    <option value={item._id}>{item.nome}</option>
                )) : <option disabled value="undefined">Loading Grupos</option>}
            </select>
            <button class="btn btn-success btn-flat margin" onClick={addItemsToGroup}>Adicionar selecionados ao grupo</button>
            </div>
        </section>
        <DataTable
                columns={columns}
                data={itensrack}
                // onRowClicked={goToGroupPage}
                pointerOnHover
                highlightOnHover
                selectableRows // add checkbox selection
                Clicked
                onSelectedRowsChange={handleChange}
                noDataComponent={''}
            />
        </div>
    </>
  )
}

export default GroupAddItem