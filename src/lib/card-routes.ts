import type { CardType } from "@/types";
import { LEGACY_ROUTES } from "@/router/constants";

/**
 * 根据卡片类型和 ID 返回对应的路由路径
 */
export function getCardRoute(cardType: CardType, cardId: string): string {
    switch (cardType) {
        case 'permanent':
            return LEGACY_ROUTES.PERMANENT(cardId);
        case 'project':
            return LEGACY_ROUTES.PROJECT(cardId);
        case 'fleeting':
        case 'literature':
        default:
            return LEGACY_ROUTES.CARD(cardId);
    }
}

/**
 * 根据卡片对象返回对应的路由路径
 */
export function getCardRouteFromCard(card: { type: CardType; id: string }): string {
    return getCardRoute(card.type, card.id);
}

