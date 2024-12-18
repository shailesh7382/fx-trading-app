// src/fxapp/FXTradeBooking.js
import React, { useContext, useState, useEffect } from 'react';
import { Typography, Container, Box, TextField, Button, Grid, Divider, Paper, MenuItem, LinearProgress } from '@mui/material';
import UserContext from './UserContext';
import BookIcon from '@mui/icons-material/Book';
import axios from 'axios';

const DetailSquare = ({ price }) => (
  <div className="detail-square">
    <div className="detail-content">
      <div>Pair: {price.ccyPair}</div>
      <div>Tenor: {price.tenor}</div>
      <div>Quantity: {price.qty}</div>
      <div>Bid: {price.bid}</div>
      <div>Ask: {price.ask}</div>
    </div>
  </div>
);

const DetailSquareLeft = ({ price }) => (
  <div className="detail-square-left">
    <div className="detail-content">
      <div>Pair: {price.ccyPair}</div>
      <div>Tenor: {price.tenor}</div>
      <div>Quantity: {price.qty}</div>
      <div>Bid: {price.bid}</div>
      <div>Ask: {price.ask}</div>
    </div>
  </div>
);

function FXTradeBooking({ fxPrice, isBid, dealtCurrency }) {
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));
  const [formData, setFormData] = useState({
    ccyPair: fxPrice ? fxPrice.ccyPair : '',
    tenor: fxPrice ? fxPrice.tenor : '',
    qty: fxPrice ? fxPrice.qty : '',
    price: fxPrice ? (isBid ? fxPrice.bid : fxPrice.ask) : '',
    direction: fxPrice ? (isBid ? 'Sell' : 'Buy') : '',
    dealtCurrency: fxPrice ? dealtCurrency || 'base' : '',
    customer: '',
    rm: '',
    sales: '',
    tradeDate: new Date().toISOString().split('T')[0],
    settlementDate: '',
    comments: ''
  });
  const [timer, setTimer] = useState(30);
  const [isBookingDisabled, setIsBookingDisabled] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [relationshipManagers, setRelationshipManagers] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const customersResponse = await axios.get('http://localhost:8081/api/customers');
        const rmsResponse = await axios.get('http://localhost:8081/api/relationshipManagers');
        const salesResponse = await axios.get('http://localhost:8081/api/sales');
        setCustomers(customersResponse.data.length ? customersResponse.data : [{ id: 1, name: 'Lorem Customer' }]);
        setRelationshipManagers(rmsResponse.data.length ? rmsResponse.data : [{ id: 1, name: 'Lorem RM' }]);
        setSales(salesResponse.data.length ? salesResponse.data : [{ id: 1, name: 'Lorem Sales' }]);
      } catch (error) {
        console.error('Error fetching options:', error);
        setCustomers([{ id: 1, name: 'Lorem Customer' }]);
        setRelationshipManagers([{ id: 1, name: 'Lorem RM' }]);
        setSales([{ id: 1, name: 'Lorem Sales' }]);
      }
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    if (fxPrice) {
      const calculateSettlementDate = (tradeDate) => {
        const date = new Date(tradeDate);
        let daysToAdd = 2;
        while (daysToAdd > 0) {
          date.setDate(date.getDate() + 1);
          if (date.getDay() !== 0 && date.getDay() !== 6) {
            daysToAdd--;
          }
        }
        return date.toISOString().split('T')[0];
      };

      setFormData((prevFormData) => ({
        ...prevFormData,
        settlementDate: calculateSettlementDate(prevFormData.tradeDate)
      }));

      const countdown = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            clearInterval(countdown);
            setIsBookingDisabled(true);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);

      return () => clearInterval(countdown);
    }
  }, [formData.tradeDate, fxPrice]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8081/api/bookTrade', formData);
      console.log('Trade booked successfully:', response.data);
    } catch (error) {
      console.error('Error booking trade:', error);
    }
  };

  const getDealtCurrencyDisplay = () => {
    return formData.dealtCurrency === 'base'
      ? formData.ccyPair.substring(0, 3)
      : formData.ccyPair.substring(3, 6);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Trade Booking
      </Typography>
      <Typography variant="body1">
        Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can book your FX trades.
      </Typography>
      <Paper elevation={3} sx={{ mt: 2, mb: 2, textAlign: 'center', backgroundColor: '#e0f7fa', padding: 1, borderRadius: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#00796b', fontSize: '1em' }}>
          Trade Date: {formData.tradeDate}
        </Typography>
      </Paper>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Currency Pair"
              name="ccyPair"
              value={formData.ccyPair}
              onChange={handleChange}
              disabled={!!fxPrice}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Tenor"
              name="tenor"
              value={formData.tenor}
              onChange={handleChange}
              disabled={!!fxPrice}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Direction"
              name="direction"
              value={formData.direction}
              onChange={handleChange}
              disabled={!!fxPrice}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Quantity"
              name="qty"
              value={formData.qty}
              onChange={handleChange}
              disabled={!!fxPrice}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Dealt Currency"
              name="dealtCurrency"
              value={getDealtCurrencyDisplay()}
              onChange={handleChange}
              disabled={!!fxPrice}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              disabled={!!fxPrice}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Settlement Date"
              name="settlementDate"
              type="date"
              value={formData.settlementDate}
              onChange={handleChange}
              InputLabelProps={{ shrink: true, style: { fontSize: '0.8em' } }}
              InputProps={{ style: { fontSize: '0.8em', height: '30px' } }}
              disabled={!!fxPrice}
            />
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" component="h3" gutterBottom sx={{ fontSize: '1em' }}>
          Additional Details
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Customer"
              name="customer"
              value={formData.customer}
              onChange={handleChange}
              InputProps={{ style: { fontSize: '0.8em', height: '35px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            >
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.name}>
                  {customer.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Relationship Manager"
              name="rm"
              value={formData.rm}
              onChange={handleChange}
              InputProps={{ style: { fontSize: '0.8em', height: '35px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            >
              {relationshipManagers.map((rm) => (
                <MenuItem key={rm.id} value={rm.name}>
                  {rm.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Sales"
              name="sales"
              value={formData.sales}
              onChange={handleChange}
              InputProps={{ style: { fontSize: '0.8em', height: '35px' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            >
              {sales.map((sale) => (
                <MenuItem key={sale.id} value={sale.name}>
                  {sale.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Comments"
              name="comments"
              value={formData.comments}
              onChange={handleChange}
              multiline
              rows={4}
              InputProps={{ style: { fontSize: '0.8em' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sx={{ textAlign: 'center' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              sx={{ fontSize: '0.8em' }}
              startIcon={<BookIcon />}
              disabled={isBookingDisabled}
            >
              Book Trade
            </Button>
            {isBookingDisabled && (
              <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                Booking disabled. Please reprice the trade.
              </Typography>
            )}
            {!isBookingDisabled && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress variant="determinate" value={(timer / 30) * 100} />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Time left to book: {timer} seconds
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default FXTradeBooking;