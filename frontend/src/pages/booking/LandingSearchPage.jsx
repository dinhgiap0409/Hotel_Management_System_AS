import React, { useEffect, useState } from 'react';
import { roomApi } from '../../services/roomApi';
import { formatVND } from '../../lib/money';

export const LandingSearchPage = () => {
  const [roomTypes, setRoomTypes] = useState([]);

  useEffect(() => {
    roomApi.getRoomTypes().then((res) => setRoomTypes(res.data.data || []));
  }, []);

  return (
    <div>
      <div style={{ background: '#0f172a', color: '#fff', padding: '36px 28px', borderRadius: 12, marginBottom: 28 }}>
        <h1 style={{ marginTop: 0 }}>ChÃ o má»«ng Ä‘áº¿n vá»›i KhÃ¡ch sáº¡n HMS Luxury</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 640 }}>
          Tra cá»©u phÃ²ng trá»‘ng theo thá»i gian thá»±c, Ã¡p dá»¥ng mÃ£ giáº£m giÃ¡ khuyáº¿n mÃ£i vÃ  thanh toÃ¡n tiá»n cá»c an toÃ n qua cá»•ng VNPay (UC-12, UC-13, UC-14).
        </p>
      </div>

      <h2>Háº¡ng phÃ²ng Ná»•i báº­t</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {roomTypes.map((rt) => (
          <div key={rt.roomTypeId} style={{ background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>{rt.typeName}</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>{rt.description}</p>
            <p style={{ fontSize: 14 }}><strong>Sá»©c chá»©a tá»‘i Ä‘a:</strong> {rt.capacity} ngÆ°á»i</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>{formatVND(rt.basePrice)} / Ä‘Ãªm</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};