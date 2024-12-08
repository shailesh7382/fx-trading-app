// src/fxapp/UserProvider.js
import React, { createContext, useState, useEffect } from 'react';

const UserContext = createContext(null);

function UserProvider({ children }) {
  const [userDetails, setUserDetails] = useState(() => {
    const storedUserDetails = sessionStorage.getItem('userDetails');
    return storedUserDetails ? JSON.parse(storedUserDetails) : null;
  });

  useEffect(() => {
    sessionStorage.setItem('userDetails', JSON.stringify(userDetails));
  }, [userDetails]);

  return (
    <UserContext.Provider value={{ userDetails, setUserDetails }}>
      {children}
    </UserContext.Provider>
  );
}

export { UserContext, UserProvider };