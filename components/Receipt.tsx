import React from 'react';
import { Sale } from '../types';
import { useAppContext } from '../contexts/AppContext';

const Receipt = React.forwardRef<HTMLDivElement, { sale: Sale }>(({ sale }, ref) => {
    const { shopInfo, customers, customerTiers } = useAppContext();
    const customer = customers.find(c => c.id === sale.customerId);
    const tier = customer?.tierId ? customerTiers.find(t => t.id === customer.tierId) : null;

    const hasItemDiscounts = sale.items.some(item => item.discount > 0);

    const formatCurrencyForReceipt = (amount: number) => `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
    const formatNumberForReceipt = (amount: number) => Math.round(amount).toLocaleString('en-IN');
    
    const calculatedOverallDiscount = sale.overallDiscount > 0
        ? Math.max(0, sale.subtotal - sale.totalItemDiscounts + (sale.laborCharges || 0) - (sale.loyaltyDiscount || 0) - sale.total)
        : 0;
        
    // By rounding the calculated discounts before checking, we avoid showing a line for amounts < 0.5 that would round to "Rs. 0".
    const showItemDiscounts = Math.round(sale.totalItemDiscounts) > 0;
    const showOverallDiscount = Math.round(calculatedOverallDiscount) > 0;
    const showLoyaltyDiscount = (sale.loyaltyDiscount || 0) > 0; // Already rounded at sale creation

    const calculateNextServiceDate = (lastVisit: string, value?: number, unit?: 'days' | 'months' | 'years'): string | null => {
        if (!value || !unit) return null;
        
        const lastVisitDate = new Date(lastVisit);
        const nextDate = new Date(lastVisitDate);

        switch (unit) {
            case 'days':
                nextDate.setDate(lastVisitDate.getDate() + value);
                break;
            case 'months':
                nextDate.setMonth(lastVisitDate.getMonth() + value);
                break;
            case 'years':
                nextDate.setFullYear(lastVisitDate.getFullYear() + value);
                break;
        }
        
        const day = String(nextDate.getDate()).padStart(2, '0');
        const month = nextDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = String(nextDate.getFullYear()).slice(-2);
        
        return `${day}-${month}-${year}`;
    };

    const nextServiceDate = customer ? calculateNextServiceDate(sale.date, customer.serviceFrequencyValue, customer.serviceFrequencyUnit) : null;
    
    return (
        <div ref={ref} className="p-4 bg-white text-black font-mono text-sm max-w-sm mx-auto">
            {/* 1 & 2. Shop Info */}
            <div className="mb-2 text-center">
                {shopInfo?.logoUrl && (
                    <img 
                        src={shopInfo.logoUrl} 
                        alt="Shop Logo" 
                        className="h-auto object-contain mx-auto mb-2"
                        style={{ width: `${shopInfo.receiptLogoSize ?? 9}rem` }}
                    />
                )}
            </div>
            
            {/* 3. Sale ID */}
            <p className="text-center font-mono my-2">Sale ID: {sale.id}</p>
            
            {/* 4. Customer Info */}
            <div className="text-left mb-2">
                Customer: {sale.customerName ? `${sale.customerName}, ${sale.customerId}` : sale.customerId}
            </div>

            {/* 5, 6, 7. Items Table */}
            <hr className="my-1 border-dashed border-black"/>
            <table className="w-full table-fixed">
                <thead>
                    <tr className="border-b border-dashed border-black text-xs">
                        {hasItemDiscounts ? (
                            <>
                                <th className="text-center font-bold w-[10%] pb-1 px-1">QTY</th>
                                <th className="text-center font-bold w-[30%] pb-1 px-1">Item</th>
                                <th className="text-center font-bold w-[20%] pb-1 px-1">Price</th>
                                <th className="text-center font-bold w-[20%] pb-1 px-1">Discount</th>
                                <th className="text-center font-bold w-[20%] pb-1 px-1">Total</th>
                            </>
                        ) : (
                            <>
                                <th className="text-center font-bold w-[10%] pb-1 px-1">QTY</th>
                                <th className="text-center font-bold w-[60%] pb-1 px-1">Item</th>
                                <th className="text-center font-bold w-[30%] pb-1 px-1">Total</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, index) => (
                        <tr key={`${item.productId}-${index}`} className="align-top text-xs">
                            {hasItemDiscounts ? (
                                <>
                                    <td className="text-center pt-1 px-1">{item.quantity}</td>
                                    <td className="text-left pt-1 px-1">{item.name}</td>
                                    <td className="text-right pt-1 px-1">{formatNumberForReceipt(item.originalPrice)}</td>
                                    <td className="text-right pt-1 px-1">
                                        {item.discount > 0 ? (item.discountType === 'fixed' ? formatNumberForReceipt(item.discount) : `${item.discount}%`) : '-'}
                                    </td>
                                    <td className="text-right pt-1 px-1">{formatNumberForReceipt(item.price * item.quantity)}</td>
                                </>
                            ) : (
                                <>
                                    <td className="text-center pt-1 px-1">{item.quantity}</td>
                                    <td className="text-left pt-1 px-1">{item.name}</td>
                                    <td className="text-right pt-1 px-1">{formatNumberForReceipt(item.price * item.quantity)}</td>
                                </>
                            )}
                        </tr>
                    ))}
                    {sale.laborCharges && sale.laborCharges > 0 && (
                        <tr className="align-top text-xs">
                            {hasItemDiscounts ? (
                                <>
                                    <td className="text-center pt-1 px-1"></td>
                                    <td colSpan={3} className="text-left pt-1 px-1">Labor Charges</td>
                                    <td className="text-right pt-1 px-1">{formatNumberForReceipt(sale.laborCharges)}</td>
                                </>
                            ) : (
                                <>
                                    <td className="text-center pt-1 px-1"></td>
                                    <td className="text-left pt-1 px-1">Labor Charges</td>
                                    <td className="text-right pt-1 px-1">{formatNumberForReceipt(sale.laborCharges)}</td>
                                </>
                            )}
                        </tr>
                    )}
                </tbody>
            </table>

            {/* 8. Line below items */}
            <hr className="my-1 border-dashed border-black"/>
            
            {/* 9 & 10. Totals */}
            <div className="space-y-1 text-xs">
                 {showOverallDiscount || showLoyaltyDiscount ? (
                    <>
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrencyForReceipt(sale.subtotal)}</span>
                        </div>
                        {showItemDiscounts && (
                            <div className="flex justify-between">
                                <span>Item Discounts</span>
                                <span>-{formatCurrencyForReceipt(sale.totalItemDiscounts)}</span>
                            </div>
                        )}
                        {showOverallDiscount && (
                            <div className="flex justify-between">
                                <span>Overall Discount</span>
                                <span>-{formatCurrencyForReceipt(calculatedOverallDiscount)}</span>
                            </div>
                        )}
                        {showLoyaltyDiscount && (
                            <div className="flex justify-between">
                                <span>Loyalty Discount</span>
                                <span>-{formatCurrencyForReceipt(sale.loyaltyDiscount!)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-dashed border-black">
                            <span>GRAND TOTAL</span>
                            <span>{formatCurrencyForReceipt(sale.total)}</span>
                        </div>
                    </>
                ) : (
                    <div className="flex justify-between font-bold text-sm my-1">
                        <span>TOTAL</span>
                        <span>{formatCurrencyForReceipt(sale.total)}</span>
                    </div>
                )}
            </div>

            {/* 11. Loyalty Points */}
            {(sale.pointsEarned !== undefined && sale.pointsEarned > 0) || (sale.redeemedPoints !== undefined && sale.redeemedPoints > 0) ? (
                 <div className="mt-4 pt-2 border-t border-dashed border-black">
                    {sale.pointsEarned !== undefined && sale.pointsEarned > 0 && <div className="flex justify-between text-xs"><span>Points Earned:</span><span>+{sale.pointsEarned}</span></div>}
                    {sale.redeemedPoints !== undefined && sale.redeemedPoints > 0 && (
                       <div className="flex justify-between text-xs"><span>Points Redeemed:</span><span>-{sale.redeemedPoints}</span></div>
                    )}
                    <div className="flex justify-between font-bold text-sm"><span>Points Balance:</span><span>{sale.finalLoyaltyPoints}</span></div>
                 </div>
            ) : null}
            
            {/* 12. Tier Message */}
            {tier && (
                <div className="text-center mt-3 text-xs">
                    <p>You are a {tier.name} Customer now. Upgrade Your Tier to Earn More Loyalty Points.</p>
                    <p>More Points… Bigger Discounts!!!</p>
                </div>
            )}

            {/* 14. Next Service Date */}
            {nextServiceDate &&
                <p className="text-center mt-3 font-semibold">See you on {nextServiceDate}</p>
            }
            
            {/* 13. Thanking Note */}
            <p className="text-center mt-3 text-xs">Thanks for Your Visit</p>
        </div>
    );
});

export default Receipt;