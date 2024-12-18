// src/fxapp/FXTradeBooking.js
import React, { useContext, useState, useEffect } from 'react';
import { Typography, Container, Box, TextField, Button, Grid, Divider, Paper } from '@mui/material';
import UserContext from './UserContext';

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
    ccyPair: fxPrice.ccyPair,
    tenor: fxPrice.tenor,
    qty: fxPrice.qty,
    price: isBid ? fxPrice.bid : fxPrice.ask,
    direction: isBid ? 'Sell' : 'Buy',
    dealtCurrency: dealtCurrency || 'base',
    customer: '',
    rm: '',
    sales: '',
    tradeDate: new Date().toISOString().split('T')[0],
    settlementDate: '',
    comments: ''
  });

  useEffect(() => {
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
  }, [formData.tradeDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log('Form data submitted:', formData);
  };

  const getDealtCurrencyDisplay = () => {
    return formData.dealtCurrency === 'base'
      ? formData.ccyPair.substring(0, 3)
      : formData.ccyPair.substring(3, 6);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
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
              disabled
              InputProps={{ style: { fontSize: '0.8em' } }}
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
              disabled
              InputProps={{ style: { fontSize: '0.8em' } }}
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
              disabled
              InputProps={{ style: { fontSize: '0.8em' } }}
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
              disabled
              InputProps={{ style: { fontSize: '0.8em' } }}
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
              disabled
              InputProps={{ style: { fontSize: '0.8em' } }}
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
              disabled
              InputProps={{ style: { fontSize: '0.8em' } }}
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
              InputProps={{ style: { fontSize: '0.8em' } }}
              disabled
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
              fullWidth
              label="Customer"
              name="customer"
              value={formData.customer}
              onChange={handleChange}
              InputProps={{ style: { fontSize: '0.8em' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Relationship Manager"
              name="rm"
              value={formData.rm}
              onChange={handleChange}
              InputProps={{ style: { fontSize: '0.8em' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Sales"
              name="sales"
              value={formData.sales}
              onChange={handleChange}
              InputProps={{ style: { fontSize: '0.8em' } }}
              InputLabelProps={{ style: { fontSize: '0.8em' } }}
            />
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
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" sx={{ fontSize: '0.8em' }}>
              Submit
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default FXTradeBooking;