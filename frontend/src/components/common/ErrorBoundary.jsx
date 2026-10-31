import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-5 text-center">
          <i className="bi bi-bug text-danger display-1"></i>
          <h3 className="mt-3">Đã xảy ra lỗi hiển thị giao diện</h3>
          <button className="btn btn-primary mt-2" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}