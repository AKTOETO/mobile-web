#ifndef ITEMMODEL_H
#define ITEMMODEL_H

#include <QAbstractListModel>
#include <QString>
#include <QVector>

/**
 * Запись инвентаря — общая модель данных для сети, SQLite-кэша и QML.
 */
struct ItemRecord
{
    QString id;
    QString name;
    int quantity = 0;
    QString location;
    QString condition;
    int version = 0;
    QString updatedAt;
};

QString conditionLabel(const QString &condition);

/**
 * Модель списка предметов для QML. Источник данных — InventoryClient:
 * после ответа сервера или чтения кэша модель заменяется целиком.
 */
class ItemModel : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(int count READ count NOTIFY countChanged)
public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        QuantityRole,
        LocationRole,
        ConditionRole,
        ConditionLabelRole,
        VersionRole
    };

    explicit ItemModel(QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    void setItems(const QVector<ItemRecord> &items);
    Q_INVOKABLE int count() const;
    void upsert(const ItemRecord &item);
    void removeById(const QString &id);

    ItemRecord itemById(const QString &id) const;

signals:
    void countChanged();

private:
    int indexOf(const QString &id) const;
    QVector<ItemRecord> m_items;
};

#endif // ITEMMODEL_H
