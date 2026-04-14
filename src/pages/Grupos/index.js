import React, { useState, useEffect } from 'react';
import api from "../../services/api";
import Header from "../../Header";
import SideMenu from "../../SideMenu";
import DataTable from 'react-data-table-component';
import './Groups.css'

function Groups({ history }) {

    const [grupos, setGrupos] = useState([]);
    const [createGroup, setCreateGroup] = useState(false)
    const [groupName, setGroupName] = useState()
    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(false)

    async function fetchGrupos() {
        setLoading(true)
        const response = await api.get('/grupos');
        setGrupos(response.data);
        setLoading(false)
    }

    useEffect(() => {
        fetchGrupos();
    }, []);

  const columns = [
    {
      name: 'Grupos',
      selector: 'nome',
      sortable: true
    }
  ];

  async function newGroup(e){
    e.preventDefault()
    setLoading(true)

    try {
        const data = {
            nome: groupName,
        }
        
        const response = await api.post('/grupos', data);

        fetchGrupos(); //Carregando nova lista de grupos
        setLoading(false)
        setError(false)
    } catch (error) {
        console.log(error)

        setLoading(false)
        setError("Erro ao tentar criar grupo")
    }
  }

  function goToGroupPage(state){
    history.push('/grupo/' + state._id);
  }

  return (
    <>
      <Header />
      <SideMenu />
      <div className="content-wrapper">
        <section className="content-header">
            <h1>Grupos</h1>
            <button type="button" class="btn btn-success btn-flat margin" onClick={() => {setCreateGroup(true)}}>Novo Grupo</button>
          </section>
        <section className='content'>
        <div style={{backgroundColor: 'white'}}>
          <div className='CreateGroup' style={createGroup ? {display: "block"} : {display: "none"}}>
            <div className='CreateGroupHeader'>
                <h4>Criar novo Grupo</h4>
            </div>
            <form onSubmit={newGroup}>
                <input type='text' placeholder='Nome do Grupo' required onChange={(e) => {setGroupName(e.target.value)}}></input>
                <button type="button" class="btn btn-danger btn-flat margin" onClick={() => {setCreateGroup(false)}}>Cancelar</button>
                <button type="submit" class="btn btn-success btn-flat margin">{loading ? "Loading..." : "Criar"}</button>
            </form>
            <p className='errorMsg'>{error ? error : ""}</p>
          </div>
        </div>
        <DataTable
            columns={columns}
            data={grupos}
            onRowClicked={goToGroupPage}
            pointerOnHover
            highlightOnHover
            // selectableRows // add checkbox selection
            Clicked
            // onSelectedRowsChange={handleChange}
            noDataComponent={''}
        />
        </section>
      </div>
    </>
  );
}

export default Groups;
