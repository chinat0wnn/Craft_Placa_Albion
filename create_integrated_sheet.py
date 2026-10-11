import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

# Create workbook
wb = openpyxl.Workbook()

# ---------------------------------------------------------
# 1. ABA DE CONFIGURAÇÕES
# ---------------------------------------------------------
ws_config = wb.active
ws_config.title = "Config e Taxas"

config_data = [
    ("Parâmetro", "Valor", "Descrição"),
    ("Taxa de Ordem de Compra", 0.025, "Taxa cobrada ao criar Buy Orders (2,5%)"),
    ("Taxa de Venda (Mercado)", 0.065, "Taxa cobrada na venda (6,5% com Premium, 10,5% sem)"),
    ("Retorno Refino (Sinergia)", 0.367, "Taxa de retorno ao refinar (Ex: 36,7% em cidade com bônus)"),
    ("Retorno Craft (Sinergia)", 0.248, "Taxa de retorno ao craftar o item (Ex: 24,8% com bônus)"),
    ("Taxa Barraca Refino", 500, "Prata por 100 de nutrição na Fundição"),
    ("Taxa Barraca Craft", 500, "Prata por 100 de nutrição na Forja de Armaduras"),
]

for row_idx, row_data in enumerate(config_data, 1):
    for col_idx, val in enumerate(row_data, 1):
        cell = ws_config.cell(row=row_idx, column=col_idx, value=val)
        if row_idx == 1:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="4F81BD", fill_type="solid")
        
# Formatação de %
for r in [2, 3, 4, 5]:
    ws_config[f"B{r}"].number_format = '0.00%'

ws_config.column_dimensions['A'].width = 25
ws_config.column_dimensions['B'].width = 15
ws_config.column_dimensions['C'].width = 60

# ---------------------------------------------------------
# 2. ABA DE REFINO (INTEGRAÇÃO VERTICAL)
# ---------------------------------------------------------
ws_refino = wb.create_sheet("Refino (Barras)")

refino_headers = [
    "Tier da Barra", "Preço Minério (Mercado)", "Preço Barra T-1 (Puxa Auto)", 
    "Item Value (IV)", "Custo Minério Bruto", "Custo Barra Antiga", 
    "Custo Barraca", "Custo Unitário Real (Integrado)"
]
ws_refino.append(refino_headers)
for col_idx in range(1, len(refino_headers) + 1):
    cell = ws_refino.cell(row=1, column=col_idx)
    cell.font = Font(bold=True)
    cell.fill = PatternFill(start_color="E26B0A", fill_type="solid")
    ws_refino.column_dimensions[get_column_letter(col_idx)].width = 20

# Linhas de Refino: T3, T4.0, T4.1, T4.2, T5.0
# T3: usa 2 minerios T3, 1 barra T2. 
# T4.0: usa 2 min T4.0, 1 barra T3.0
# T4.1: usa 2 min T4.1, 1 barra T3.0
refino_rows = [
    ["T3.0", 35, 15, 6],    # Row 2 (Barra T2 cost simulado 15)
    ["T4.0", 120, "=H2", 16],   # Row 3 (Puxa Custo Real do T3)
    ["T4.1", 200, "=H2", 32],   # Row 4 (Puxa Custo Real do T3)
    ["T4.2", 800, "=H2", 64],   # Row 5 (Puxa Custo Real do T3)
    ["T5.0", 300, "=H3", 30],   # Row 6 (Puxa Custo Real do T4.0)
]

for idx, r_data in enumerate(refino_rows, 2):
    ws_refino.cell(row=idx, column=1, value=r_data[0]) # Tier
    ws_refino.cell(row=idx, column=2, value=r_data[1]) # Preco Minerio
    ws_refino.cell(row=idx, column=3, value=r_data[2]) # Preco T-1
    ws_refino.cell(row=idx, column=4, value=r_data[3]) # IV
    
    # Custo Minério (Qtd * Preco * (1 + Taxa Compra))
    qtd_min = 2 if "T3" in r_data[0] or "T4" in r_data[0] else 3
    ws_refino.cell(row=idx, column=5, value=f"={qtd_min}*B{idx}*(1+'Config e Taxas'!$B$2)")
    
    # Custo Barra Antiga (Qtd * Preco T-1 * (1 + Taxa Compra se for comprada, mas aqui assumimos custo limpo))
    # Vamos assumir que a barra t-1 se originou de nós mesmos, sem taxa de compra nela.
    ws_refino.cell(row=idx, column=6, value=f"=1*C{idx}")
    
    # Custo Barraca = IV * 0.1125 * Taxa / 100
    ws_refino.cell(row=idx, column=7, value=f"=D{idx}*0.1125*('Config e Taxas'!$B$6/100)") # wait, IV is D? No, IV is Col D (idx 4)
    ws_refino.cell(row=idx, column=7, value=f"=D{idx}*0.1125*('Config e Taxas'!$B$6/100)")
    
    # Custo Unitário Real = (Min + Antiga + Barraca) * (1 - Retorno)
    ws_refino.cell(row=idx, column=8, value=f"=(E{idx}+F{idx}+G{idx})*(1-'Config e Taxas'!$B$4)")
    ws_refino.cell(row=idx, column=8).font = Font(bold=True, color="009900")

# ---------------------------------------------------------
# 3. ABA DE CRAFT (PLACAS)
# ---------------------------------------------------------
ws_craft = wb.create_sheet("Craft (Equip de Placas)")

craft_headers = [
    "Item", "Tier", "Qtd Barras", "Custo Barra (Refino)", 
    "Item Value (IV)", "Custo Base Material", "Economia do Retorno", 
    "Taxa do Ferreiro", "CUSTO TOTAL DO ITEM", 
    "Preço Venda (Mercado)", "Taxa de Venda", "LUCRO REAL", "Margem (%)"
]
ws_craft.append(craft_headers)
for col_idx in range(1, len(craft_headers) + 1):
    cell = ws_craft.cell(row=1, column=col_idx)
    cell.font = Font(bold=True)
    cell.fill = PatternFill(start_color="7030A0", fill_type="solid")
    ws_craft.column_dimensions[get_column_letter(col_idx)].width = 18

craft_rows = [
    # Item, Tier, Qtd, RefinoRow(CustoBarra), IV, PrecoVenda
    ("Armadura de Placas", "T4.0", 16, 3, 256, 15000),
    ("Elmo de Placas", "T4.0", 8, 3, 128, 8000),
    ("Botas de Placas", "T4.0", 8, 3, 128, 8000),
    ("Armadura de Placas", "T4.1", 16, 4, 512, 35000),
    ("Armadura de Placas", "T5.0", 16, 6, 512, 25000),
]

for idx, c_data in enumerate(craft_rows, 2):
    ws_craft.cell(row=idx, column=1, value=c_data[0]) # Item
    ws_craft.cell(row=idx, column=2, value=c_data[1]) # Tier
    ws_craft.cell(row=idx, column=3, value=c_data[2]) # Qtd Barras
    ws_craft.cell(row=idx, column=4, value=f"='Refino (Barras)'!H{c_data[3]}") # Custo Barra
    ws_craft.cell(row=idx, column=5, value=c_data[4]) # IV
    
    # Custo Base Mat = Qtd * Custo Barra
    ws_craft.cell(row=idx, column=6, value=f"=C{idx}*D{idx}")
    
    # Economia Retorno = Custo Base Mat * Retorno Craft
    ws_craft.cell(row=idx, column=7, value=f"=F{idx}*'Config e Taxas'!$B$5")
    
    # Taxa Ferreiro = IV * 0.1125 * Taxa Craft / 100
    ws_craft.cell(row=idx, column=8, value=f"=E{idx}*0.1125*('Config e Taxas'!$B$7/100)")
    
    # CUSTO TOTAL = Base - Economia + Taxa
    ws_craft.cell(row=idx, column=9, value=f"=F{idx}-G{idx}+H{idx}")
    ws_craft.cell(row=idx, column=9).font = Font(bold=True)
    
    # Preco Venda
    ws_craft.cell(row=idx, column=10, value=c_data[5])
    
    # Taxa Venda = Venda * TaxaVendaConfig
    ws_craft.cell(row=idx, column=11, value=f"=J{idx}*'Config e Taxas'!$B$3")
    
    # LUCRO = Venda - Taxa Venda - CUSTO TOTAL
    ws_craft.cell(row=idx, column=12, value=f"=J{idx}-K{idx}-I{idx}")
    ws_craft.cell(row=idx, column=12).font = Font(bold=True, color="0000FF")
    
    # Margem
    ws_craft.cell(row=idx, column=13, value=f"=L{idx}/I{idx}")
    ws_craft.cell(row=idx, column=13).number_format = '0.00%'

wb.save("Planilha_Integrada_Placas.xlsx")
print("Planilha criada com sucesso!")
