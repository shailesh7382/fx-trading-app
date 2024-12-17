// src/fxapp/FXTradeBooking.js
import React, { useContext } from 'react';
import { Typography, Container, Box } from '@mui/material';
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

function FXTradeBooking({ fxPrice, isBid }) {
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Trade Booking
      </Typography>
      <Typography variant="body1">
        Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can book your FX trades.
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6">Trade Details:</Typography>
        <Typography variant="body2">Currency Pair: {fxPrice.ccyPair}</Typography>
        <Typography variant="body2">Tenor: {fxPrice.tenor}</Typography>
        <Typography variant="body2">Quantity: {fxPrice.qty}</Typography>
        <Typography variant="body2">Price: {isBid ? fxPrice.bid : fxPrice.ask}</Typography>
        <Typography variant="body2">Type: {isBid ? 'Bid' : 'Ask'}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, position: 'relative' }}>
        <DetailSquare price={fxPrice} />
        <div className="detail-square-connector"></div>
        <DetailSquareLeft price={fxPrice} />
      </Box>
    </Container>
  );
}

export default FXTradeBooking;