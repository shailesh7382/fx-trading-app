import React, { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { IconButton } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import { useNavigate } from 'react-router-dom';
import './FXApp.css';

function FXRateGrid() {
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));
  const [fxPrices, setFxPrices] = useState([]);
  const previousPrices = useRef([]);
  const navigate = useNavigate();

  const columnDefs = [
    { headerName: 'Pair', field: 'ccyPair', flex: 1 },
    { headerName: 'Tenor', field: 'tenor', flex: 0.5 },
    { headerName: 'Quantity', field: 'qty', flex: 1 },
    {
      headerName: 'Bid',
      field: 'bid',
      flex: 1,
      cellRenderer: (params) => highlightChangedDigits(params.value, getPreviousPrice(params.data.ccyPair, 'bid')),
      onCellClicked: (params) => handleCellClick(params, true),
    },
    {
      headerName: 'Ask',
      field: 'ask',
      flex: 1,
      cellRenderer: (params) => highlightChangedDigits(params.value, getPreviousPrice(params.data.ccyPair, 'ask')),
      onCellClicked: (params) => handleCellClick(params, false),
    },
    { headerName: 'Updated At', field: 'updatedAt', flex: 2 }
  ];

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await axios.get('http://localhost:8081/api/fxprices');
        previousPrices.current = fxPrices;
        setFxPrices(response.data);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    const intervalId = setInterval(fetchPrices, 3000);
    return () => clearInterval(intervalId);
  }, [fxPrices]);

  const getPreviousPrice = (id, field) => {
    const previousPrice = previousPrices.current.find(price => price.ccyPair === id);
    return previousPrice ? previousPrice[field] : null;
  };

  const highlightChangedDigits = (current, previous) => {
    if (!previous) return current;

    const currentStr = current.toFixed(4);
    const previousStr = previous.toFixed(4);

    return currentStr.split('').map((char, index) => {
      let style = {};
      if (index === currentStr.length - 1) {
        style = { fontSize: '0.75em' };
      } else if (index === currentStr.length - 3 || index === currentStr.length - 2) {
        style = { fontSize: '1.25em' };
      }

      if (char !== previousStr[index]) {
        style.color = char > previousStr[index] ? 'green' : 'red';
      }

      return <span key={index} style={style}>{char}</span>;
    });
  };

  const handleCellClick = (params, isBid) => {
    navigate('/trade-booking', { state: { fxPrice: params.data, isBid } });
  };

  const downloadExcel = () => {
    const transformedData = fxPrices.map(price => ({
      Pair: price.ccyPair,
      Tenor: price.tenor,
      Quantity: price.qty,
      'Bid Price': price.bid,
      'Ask Price': price.ask,
      'Updated At': price.updatedAt
    }));
    const worksheet = XLSX.utils.json_to_sheet(transformedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FX Prices');
    XLSX.writeFile(workbook, 'FX_Prices.xlsx');
  };

  return (
    <div className="ag-theme-alpine" style={{ height: 600, width: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ marginRight: 'auto' }}>FX Prices</h2>
        <IconButton onClick={downloadExcel} color="primary">
          <GetAppIcon />
        </IconButton>
      </div>
      <AgGridReact
        rowData={fxPrices}
        columnDefs={columnDefs}
      />
    </div>
  );
}

export default FXRateGrid;