#include "itemmodel.h"

#include <QDebug>

QString conditionLabel(const QString &condition)
{
    if (condition == QLatin1String("new")) return QStringLiteral("новый");
    if (condition == QLatin1String("good")) return QStringLiteral("хорошее");
    if (condition == QLatin1String("used")) return QStringLiteral("б/у");
    if (condition == QLatin1String("broken")) return QStringLiteral("неисправен");
    return condition;
}

ItemModel::ItemModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

int ItemModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) return 0;
    return m_items.size();
}

QVariant ItemModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_items.size())
        return QVariant();

    const ItemRecord &item = m_items.at(index.row());
    switch (role) {
    case IdRole: return item.id;
    case NameRole: return item.name;
    case QuantityRole: return item.quantity;
    case LocationRole: return item.location;
    case ConditionRole: return item.condition;
    case ConditionLabelRole: return conditionLabel(item.condition);
    case VersionRole: return item.version;
    default: return QVariant();
    }
}

QHash<int, QByteArray> ItemModel::roleNames() const
{
    QHash<int, QByteArray> roles;
    roles.insert(IdRole, "itemId");
    roles.insert(NameRole, "name");
    roles.insert(QuantityRole, "quantity");
    roles.insert(LocationRole, "location");
    roles.insert(ConditionRole, "condition");
    roles.insert(ConditionLabelRole, "conditionLabel");
    roles.insert(VersionRole, "version");
    return roles;
}

void ItemModel::setItems(const QVector<ItemRecord> &items)
{
    beginResetModel();
    m_items = items;
    endResetModel();
    emit countChanged();
}

void ItemModel::upsert(const ItemRecord &item)
{
    int row = indexOf(item.id);
    if (row >= 0) {
        m_items[row] = item;
        const QModelIndex idx = index(row, 0);
        emit dataChanged(idx, idx);
    } else {
        beginInsertRows(QModelIndex(), m_items.size(), m_items.size());
        m_items.append(item);
        endInsertRows();
        emit countChanged();
    }
}

void ItemModel::removeById(const QString &id)
{
    int row = indexOf(id);
    if (row < 0) return;
    beginRemoveRows(QModelIndex(), row, row);
    m_items.remove(row);
    endRemoveRows();
    emit countChanged();
}

int ItemModel::count() const
{
    return m_items.size();
}

ItemRecord ItemModel::itemById(const QString &id) const
{
    int row = indexOf(id);
    return row >= 0 ? m_items.at(row) : ItemRecord();
}

int ItemModel::indexOf(const QString &id) const
{
    for (int i = 0; i < m_items.size(); ++i) {
        if (m_items.at(i).id == id) return i;
    }
    return -1;
}
