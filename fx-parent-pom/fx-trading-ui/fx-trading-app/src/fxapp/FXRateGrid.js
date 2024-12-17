import React, { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { IconButton } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import InputMask from 'react-input-mask';
import './FXApp.css';
import FXTradeBooking from './FXTradeBooking';

const tenors = [
  { value: 'SP', label: 'SP' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' }
];

const TriangleUp = () => <span style={{ color: 'green', fontSize: '1.5em' }}>▲</span>;
const TriangleDown = () => <span style={{ color: 'red', fontSize: '1.5em' }}>▼</span>;

function FXRateGrid({ setSelectedComponent }) {
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
    }
  ];

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await axios.get('http://localhost:8081/api/fxprices');
        previousPrices.current = fxPrices;
        const updatedPrices = response.data.map(price => ({
          ...price,
          dealtCurrency: 'base' // Initialize dealtCurrency as 'base'
        }));
        setFxPrices(updatedPrices);
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

    const currentStr = current.toFixed(5).replace(/0+$/, ''); // Remove trailing zeros
    const previousStr = previous.toFixed(5).replace(/0+$/, '');

    let colorInc = currentStr > previousStr ? 'green' : 'red';

    return currentStr.split('').map((char, index) => {
      let style = { position: 'relative' };
      if (index === currentStr.length - 1) {
        style = { ...style, fontSize: '0.6em', top: '-0.40em' }; // Smaller font size for the last digit, align top
      } else if (index === currentStr.length - 3 || index === currentStr.length - 2) {
        style = { ...style, fontSize: '1.6em' }; // Bigger font size, align middle
        style.color = colorInc;
      } else {
        style = { ...style, bottom: '-0.2em' }; // Align bottom for other digits
      }

      return <span key={index} style={style}>{char}</span>;
    });
  };

  const handleCellClick = (params, isBid) => {
    setSelectedComponent(<FXTradeBooking fxPrice={params.data} isBid={isBid} />);
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

  const getTimeDifferenceInSeconds = (timestamp) => {
    const now = new Date();
    const updatedAt = new Date(timestamp);
    const differenceInSeconds = Math.floor((now - updatedAt) / 1000);
    return (
      <span style={{ fontSize: '0.75em' }}>
        {differenceInSeconds} seconds ago
      </span>
    );
  };

  const formatQuantity = (qty) => {
    if (qty >= 1_000_000_000) {
      return (qty / 1_000_000_000).toFixed(0) + 'B';
    } else if (qty >= 1_000_000) {
      return (qty / 1_000_000).toFixed(0) + 'M';
    } else if (qty >= 1_000) {
      return (qty / 1_000).toFixed(0) + 'K';
    } else {
      return qty.toString();
    }
  };

  const formatQuantityInMillions = (qty) => {
    return (qty / 1_000_000).toFixed(2) + 'M';
  };

  const getDealtCurrency = (ccyPair, dealtCurrency) => {
    // Toggle between base and terms currency
    return dealtCurrency === 'terms' ? ccyPair.substring(3, 6) : ccyPair.substring(0, 3);
  };

  const toggleDealtCurrency = (index) => {
    setFxPrices((prev) => {
      const updatedPrices = [...prev];
      updatedPrices[index].dealtCurrency = updatedPrices[index].dealtCurrency === 'base' ? 'terms' : 'base';
      return updatedPrices;
    });
  };

  const handleTenorChange = (index, newTenor) => {
    setFxPrices((prev) => {
      const updatedPrices = [...prev];
      updatedPrices[index].tenor = newTenor.value;
      return updatedPrices;
    });
  };

  const handleQuantityChange = (index, newQty) => {
    setFxPrices((prev) => {
      const updatedPrices = [...prev];
      updatedPrices[index].qty = newQty;
      return updatedPrices;
    });
  };

  return (
    <div className="fx-rate-grid-panel">
      <div className="fx-rate-grid-header">
        <h1>FX Rate Grid</h1>
        <IconButton onClick={downloadExcel} color="primary">
          <GetAppIcon />
        </IconButton>
      </div>
      <div className="fx-rate-grid">
        {fxPrices.slice(0, 15).map((price, index) => ( // Limit to first 15 prices
          <div key={index} className="fx-rate-cell">
            <div className="fx-rate-cell-header">{price.ccyPair}</div>
            <div className="fx-rate-cell-body">
              <div className="fx-rate-row">
                <div
                  className="fx-rate-box-bid"
                  data-hover-text={`Sell ${formatQuantityInMillions(price.qty)} ${getDealtCurrency(price.ccyPair, price.dealtCurrency)}`}
                  onClick={() => handleCellClick({ data: price }, true)}
                >
                  {highlightChangedDigits(price.bid, getPreviousPrice(price.ccyPair, 'bid'))}
                </div>
                <div
                  className="fx-rate-box-ask"
                  data-hover-text={`Buy ${formatQuantityInMillions(price.qty)} ${getDealtCurrency(price.ccyPair, price.dealtCurrency)}`}
                  onClick={() => handleCellClick({ data: price }, false)}
                >
                  {highlightChangedDigits(price.ask, getPreviousPrice(price.ccyPair, 'ask'))}
                </div>
              </div>
              <div className="fx-rate-row">
                <Select
                  options={tenors}
                  value={tenors.find(option => option.value === price.tenor) || tenors[0]}
                  onChange={(selectedOption) => handleTenorChange(index, selectedOption)}
                  isSearchable={false}
                  styles={{
                    container: (provided) => ({ ...provided, minWidth: 25, marginRight: 1 }),
                    control: (provided) => ({ ...provided, minHeight: 20, fontSize: '0.60em', border: 'none' }),
                    menu: (provided) => ({ ...provided, fontSize: '0.60em' })
                  }}
                />
                <div className="fx-triangle">
                  <TriangleUp />
                  <TriangleDown />
                </div>
                <InputMask
                  mask="9999999"
                  value={price.qty}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                >
                  {(inputProps) => <input {...inputProps} type="text" className="quantity-input" />}
                </InputMask>
                <div className="fx-dealt-currency" onClick={() => toggleDealtCurrency(index)}>
                  {getDealtCurrency(price.ccyPair, price.dealtCurrency)}
                </div>
              </div>
              <div className="fx-rate-time">{getTimeDifferenceInSeconds(price.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FXRateGrid;