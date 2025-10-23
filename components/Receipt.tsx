
import React from 'react';
import { Sale } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatDate } from '../utils/helpers';

interface ReceiptProps {
    sale: Sale;
}

// FIX: Removed React.FC type from forwardRef component to allow ref to be passed correctly.
// React.FC does not include `ref` in its props definition, which caused a type error.
const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ sale }, ref) => {
    const { shopInfo, customers } = useAppContext();
    const hasDiscounts = (sale.totalItemDiscounts || 0) > 0 || (sale.overallDiscount || 0) > 0 || (sale.loyaltyDiscount || 0) > 0;
    const calculatedOverallDiscount = sale.subtotal - sale.totalItemDiscounts - (sale.loyaltyDiscount || 0) - sale.total;
    const hasItemDiscounts = sale.items.some(item => item.discount > 0);

    const formatReceiptCurrency = (amount: number) => Math.round(amount).toLocaleString('en-IN');

    const customer = customers.find(c => c.id === sale.customerId);
    let nextServiceMessage = null;

    // Check if the frequency was set for the customer associated with this sale
    if (customer && customer.serviceFrequencyValue && customer.serviceFrequencyUnit) {
        const saleDate = new Date(sale.date);
        const nextServiceDate = new Date(saleDate);

        switch (customer.serviceFrequencyUnit) {
            case 'days':
                nextServiceDate.setDate(saleDate.getDate() + customer.serviceFrequencyValue);
                break;
            case 'months':
                nextServiceDate.setMonth(saleDate.getMonth() + customer.serviceFrequencyValue);
                break;
            case 'years':
                nextServiceDate.setFullYear(saleDate.getFullYear() + customer.serviceFrequencyValue);
                break;
        }

        const day = nextServiceDate.getDate().toString().padStart(2, '0');
        const month = nextServiceDate.toLocaleString('en-US', { month: 'short' });
        const year = nextServiceDate.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;

        nextServiceMessage = `See you on ${formattedDate}.`;
    }

    return (
        <div ref={ref} className="bg-white p-4 w-full max-w-sm font-mono text-xs text-black">
            <div className="text-center mb-4">
                <h2 className="text-lg font-bold">{shopInfo?.name}</h2>
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
            <hr className="my-3 border-dashed border-gray-400" />
            <table className="w-full table-fixed text-xs">
                 <thead>
                    <tr>
                        <th className="w-[15%] text-left font-normal pb-1">QTY</th>
                        <th className={`${hasItemDiscounts ? 'w-[35%]' : 'w-[55%]'} text-left font-normal pb-1`}>ITEM</th>
                        {hasItemDiscounts && <th className="w-[18%] text-right font-normal pb-1">PRICE</th>}
                        {hasItemDiscounts && <th className="w-[17%] text-right font-normal pb-1">DISC</th>}
                        <th className={`${hasItemDiscounts ? 'w-[20%]' : 'w-[30%]'} text-right font-normal pb-1`}>
                            {hasItemDiscounts ? 'TOTAL' : 'PRICE'}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item) => (
                        <tr key={item.productId}>
                            <td className="text-left py-1 align-top">{item.quantity}</td>
                            <td className="text-left py-1 pr-2 align-top break-words">{item.name}</td>
                            {hasItemDiscounts && <td className="text-right py-1 align-top whitespace-nowrap">{formatReceiptCurrency(item.originalPrice)}</td>}
                            {hasItemDiscounts && (
                                <td className="text-right py-1 align-top whitespace-nowrap">
                                    {item.discount > 0
                                        ? (item.discountType === 'fixed'
                                            ? `-${formatReceiptCurrency(item.discount)}`
                                            : `${item.discount}%`)
                                        : '-'
                                    }
                                </td>
                            )}
                            <td className="text-right py-1 align-top whitespace-nowrap font-semibold">
                                {formatReceiptCurrency(item.price * item.quantity)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr className="my-3 border-dashed border-gray-400" />
             {hasDiscounts ? (
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>Rs. {formatReceiptCurrency(sale.subtotal)}</span>
                    </div>
                    {sale.totalItemDiscounts > 0 && (
                        <div className="flex justify-between">
                            <span>Item Discounts</span>
                            <span>- Rs. {formatReceiptCurrency(sale.totalItemDiscounts)}</span>
                        </div>
                    )}
                    {(sale.overallDiscount || 0) > 0 && (
                        <div className="flex justify-between">
                            <span>Overall Discount {sale.overallDiscountType === 'percentage' && `(${sale.overallDiscount}%)`}</span>
                            <span>- Rs. {formatReceiptCurrency(calculatedOverallDiscount)}</span>
                        </div>
                    )}
                     {(sale.loyaltyDiscount || 0) > 0 && (
                        <div className="flex justify-between">
                            <span>Loyalty Discount ({sale.redeemedPoints} pts)</span>
                            <span>- Rs. {formatReceiptCurrency(sale.loyaltyDiscount!)}</span>
                        </div>
                    )}
                </div>
            ) : null}
            <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t-2 border-dashed border-gray-400">
                <span>TOTAL</span>
                <span className="whitespace-nowrap">Rs. {formatReceiptCurrency(sale.total)}</span>
            </div>
             {(sale.pointsEarned !== undefined || sale.finalLoyaltyPoints !== undefined) && (
                <>
                    <hr className="my-3 border-dashed border-gray-400" />
                    <div className="space-y-1 text-xs text-center">
                        <p><strong>Loyalty Points Update</strong></p>
                        <p>Points Earned: {sale.pointsEarned || 0}</p>
                        <p>New Balance: {sale.finalLoyaltyPoints || 0} Points</p>
                    </div>
                </>
            )}
            <div className="text-center mt-4 text-xs">
                <p>Thank You for Your Visit!</p>
                {nextServiceMessage && <p className="mt-1">{nextServiceMessage}</p>}
            </div>
        </div>
    );
});

export default Receipt;