import React from 'react';
import { Sale } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency, formatDate } from '../utils/helpers';

interface ReceiptProps {
    sale: Sale;
}

// FIX: Removed React.FC type from forwardRef component to allow ref to be passed correctly.
// React.FC does not include `ref` in its props definition, which caused a type error.
const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ sale }, ref) => {
    const { shopInfo } = useAppContext();

    return (
        <div ref={ref} className="bg-white p-6 rounded-lg shadow-sm w-full max-w-sm font-mono text-sm text-black">
            <div className="text-center mb-4">
                <h2 className="text-xl font-bold">{shopInfo?.name}</h2>
                <p className="text-xs">{shopInfo?.address}</p>
                <p className="text-xs mt-1">{formatDate(sale.date)}</p>
                <p className="text-xs mt-1 font-semibold">Sale ID: {sale.id}</p>
            </div>
            {(sale.customerName || sale.customerId) && (
                <>
                    <div className="text-left mb-2 text-xs">
                        {sale.customerName && <p><strong>Customer:</strong> {sale.customerName}</p>}
                        {sale.customerId && <p><strong>Bike No:</strong> {sale.customerId}</p>}
                    </div>
                </>
            )}
            <hr className="my-2 border-dashed border-gray-400" />
            <table className="w-full table-fixed">
                <thead>
                    <tr>
                        <th className="w-[15%] text-left font-normal pb-1">QTY</th>
                        <th className="w-[55%] text-left font-normal pb-1">ITEM</th>
                        <th className="w-[30%] text-right font-normal pb-1">PRICE</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item) => (
                        <tr key={item.productId}>
                            <td className="text-left py-1 align-top">{item.quantity}</td>
                            <td className="text-left py-1 pr-2 align-top break-words">{item.name}</td>
                            <td className="text-right py-1 align-top whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr className="my-2 border-dashed border-gray-400" />
            <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span>
                <span className="whitespace-nowrap">{formatCurrency(sale.total)}</span>
            </div>
            <div className="text-center mt-4 text-xs">
                <p>Thank you for your purchase!</p>
            </div>
        </div>
    );
});

export default Receipt;
