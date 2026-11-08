export const PaginationControl = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalItems === 0) return null;
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const paginationBtnStyle = (isActive, isDisabled) => ({
    padding: '5px 10px',
    fontSize: 12.5,
    fontWeight: isActive ? 700 : 500,
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    background: isActive ? '#0284c7' : '#fff',
    color: isActive ? '#fff' : isDisabled ? '#94a3b8' : '#334155',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
  });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        padding: '8px 4px',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#64748b' }}>
        <span>
          Hiển thị <strong>{startItem} - {endItem}</strong> trên tổng số <strong>{totalItems}</strong> dòng
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Số dòng:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 5,
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
              background: '#fff',
            }}
          >
            <option value={5}>5 dòng</option>
            <option value={10}>10 dòng</option>
            <option value={20}>20 dòng</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          style={paginationBtnStyle(false, currentPage === 1)}
        >
          &laquo; Đầu
        </button>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={paginationBtnStyle(false, currentPage === 1)}
        >
          &lsaquo; Trước
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#94a3b8' }}>
              ...
            </span>
          ) : (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              style={paginationBtnStyle(currentPage === p, false)}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={paginationBtnStyle(false, currentPage === totalPages)}
        >
          Sau &rsaquo;
        </button>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          style={paginationBtnStyle(false, currentPage === totalPages)}
        >
          Cuối &raquo;
        </button>
      </div>
    </div>
  );
};

